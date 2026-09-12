import { getSupabaseAdmin } from '../supabaseAdmin';
import { hasMetaPublishScopes, isTerminalPublishError } from '../../shared/calendarPublish';
import { fetchGrantedMetaScopes } from './providers';
import { publishCalendarItemToMeta } from './publish';

async function loadMetaSecret(
  admin: ReturnType<typeof getSupabaseAdmin>,
  orgId: string,
  clientId: string,
  platform: 'instagram' | 'facebook'
) {
  const order = platform === 'instagram' ? ['instagram', 'facebook'] : ['facebook', 'instagram'];
  for (const candidate of order) {
    const { data: connection } = await admin
      .from('social_connections')
      .select('id, platform, external_id, account_name, status')
      .eq('org_id', orgId)
      .eq('client_id', clientId)
      .eq('platform', candidate)
      .maybeSingle();
    if (!connection?.id) continue;
    const { data: secret } = await admin
      .from('social_connection_secrets')
      .select('access_token, scopes')
      .eq('connection_id', connection.id)
      .maybeSingle();
    if (!secret?.access_token) continue;
    return { connection, secret };
  }
  return null;
}

async function claimItem(admin: ReturnType<typeof getSupabaseAdmin>, id: string) {
  const { data, error } = await admin.rpc('claim_calendar_publish', { p_id: id });
  if (error) throw new Error(error.message);
  console.info('[publish] claim', { itemId: id, claimed: Boolean(data) });
  return Boolean(data);
}

async function recordAttempt(
  admin: ReturnType<typeof getSupabaseAdmin>,
  input: {
    itemId: string;
    orgId: string;
    clientId: string;
    platform: string;
    status: string;
    providerPostId?: string;
    permalink?: string;
    error?: string;
    requestedBy?: string | null;
    source: string;
  }
) {
  await admin.from('calendar_publish_attempts').insert({
    calendar_item_id: input.itemId,
    org_id: input.orgId,
    client_id: input.clientId,
    platform: input.platform,
    status: input.status,
    provider_post_id: input.providerPostId || null,
    provider_permalink: input.permalink || null,
    error: input.error || null,
    requested_by: input.requestedBy || null,
    source: input.source,
    finished_at: new Date().toISOString(),
  });
}

export async function publishOneCalendarItem(input: {
  itemId: string;
  orgId: string;
  requestedBy?: string | null;
  source: 'manual' | 'cron' | 'flush';
  force?: boolean;
}) {
  const admin = getSupabaseAdmin();
  const { data: item, error } = await admin
    .from('calendar_items')
    .select(
      'id, client_id, platform, content_type, topic, hook_text, caption_text, cta, visual_asset_url, visual_asset_type, provider_post_id, provider_container_id, publish_blocked, status'
    )
    .eq('id', input.itemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!item) throw new Error('Calendar item not found.');

  const { data: client } = await admin
    .from('clients')
    .select('id, org_id, name')
    .eq('id', item.client_id)
    .maybeSingle();
  if (!client || client.org_id !== input.orgId) throw new Error('Client not found in your organization.');

  if (item.provider_post_id) {
    return {
      success: true,
      alreadyPublished: true,
      itemId: item.id,
      providerPostId: item.provider_post_id,
    };
  }

  if (item.publish_blocked && !input.force) {
    throw new Error('This post is blocked until the last publish error is fixed. Use Publish now after you reconnect or replace the media.');
  }

  const claimed = await claimItem(admin, item.id);
  if (!claimed) {
    if (input.source === 'manual') {
      throw new Error('This post is already publishing or already live. Wait a moment and refresh.');
    }
    return { success: false, skipped: true, itemId: item.id };
  }

  const platform = item.platform === 'facebook' ? 'facebook' : item.platform === 'instagram' ? 'instagram' : null;
  if (!platform) {
    const message = `TERMINAL: GrowthOS does not publish ${item.platform} from the calendar yet.`;
    await admin
      .from('calendar_items')
      .update({
        publish_error: message,
        publish_blocked: true,
        publish_lock_until: null,
      })
      .eq('id', item.id);
    await recordAttempt(admin, {
      itemId: item.id,
      orgId: input.orgId,
      clientId: item.client_id,
      platform: item.platform,
      status: 'failed',
      error: message,
      requestedBy: input.requestedBy,
      source: input.source,
    });
    throw new Error(message);
  }

  const bound = await loadMetaSecret(admin, input.orgId, item.client_id, platform);
  if (!bound) {
    const message = `TERMINAL: Connect the ${platform === 'instagram' ? 'Instagram professional' : 'Facebook Page'} account for this brand first.`;
    await failItem(admin, item, input, message);
    throw new Error(message);
  }
  const liveScopes = await fetchGrantedMetaScopes(bound.secret.access_token).catch((err: any) => {
    console.warn('[publish] live permission check failed, using stored scopes', err.message);
    return bound.secret.scopes || '';
  });
  if (liveScopes && liveScopes !== bound.secret.scopes) {
    await admin
      .from('social_connection_secrets')
      .update({ scopes: liveScopes, updated_at: new Date().toISOString() })
      .eq('connection_id', bound.connection.id);
  }
  const scopes = liveScopes || bound.secret.scopes || '';
  console.info('[publish] permissions', {
    itemId: item.id,
    platform,
    canPublish: hasMetaPublishScopes(platform, scopes),
  });
  if (!hasMetaPublishScopes(platform, scopes)) {
    const message =
      'TERMINAL: This Meta login is insights-only. Reconnect the account and accept Instagram/Facebook publishing.';
    await failItem(admin, item, input, message);
    throw new Error(message);
  }

  try {
    const result = await publishCalendarItemToMeta({
      platform,
      contentType: item.content_type,
      topic: item.topic,
      hookText: item.hook_text,
      captionText: item.caption_text,
      cta: item.cta,
      mediaUrl: item.visual_asset_url,
      mediaType: item.visual_asset_type,
      userToken: bound.secret.access_token,
      externalId: bound.connection.external_id || undefined,
      clientName: client.name,
      existingContainerId: item.provider_container_id,
      onContainer: async (containerId) => {
        await admin
          .from('calendar_items')
          .update({ provider_container_id: containerId })
          .eq('id', item.id);
      },
      onPublished: async (providerPostId) => {
        await admin
          .from('calendar_items')
          .update({
            status: 'published',
            published_at: new Date().toISOString(),
            provider_post_id: providerPostId,
            publish_error: null,
            publish_blocked: false,
          })
          .eq('id', item.id);
      },
    });

    const { error: updateErr } = await admin
      .from('calendar_items')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        provider_post_id: result.providerPostId,
        provider_permalink: result.permalink || null,
        provider_container_id: result.containerId || null,
        publish_error: null,
        publish_blocked: false,
        publish_lock_until: null,
      })
      .eq('id', item.id);
    if (updateErr) throw new Error(updateErr.message);

    await recordAttempt(admin, {
      itemId: item.id,
      orgId: input.orgId,
      clientId: item.client_id,
      platform,
      status: 'published',
      providerPostId: result.providerPostId,
      permalink: result.permalink,
      requestedBy: input.requestedBy,
      source: input.source,
    });

    return {
      success: true,
      itemId: item.id,
      providerPostId: result.providerPostId,
      permalink: result.permalink,
      accountLabel: result.accountLabel,
      note: result.note,
    };
  } catch (err: any) {
    const pending = Boolean(err.containerPending);
    const message = String(err.message || 'Publish failed.');
    const blocked = !pending && isTerminalPublishError(message);
    await admin
      .from('calendar_items')
      .update({
        publish_error: message,
        publish_blocked: blocked,
        provider_container_id: err.containerId || item.provider_container_id || null,
        publish_lock_until: pending ? new Date(Date.now() + 60 * 1000).toISOString() : null,
      })
      .eq('id', item.id);
    await recordAttempt(admin, {
      itemId: item.id,
      orgId: input.orgId,
      clientId: item.client_id,
      platform,
      status: pending ? 'processing' : 'failed',
      error: message,
      requestedBy: input.requestedBy,
      source: input.source,
    });
    throw err;
  }
}

async function failItem(
  admin: ReturnType<typeof getSupabaseAdmin>,
  item: { id: string; client_id: string; platform: string },
  input: { orgId: string; requestedBy?: string | null; source: string },
  message: string
) {
  await admin
    .from('calendar_items')
    .update({
      publish_error: message,
      publish_blocked: isTerminalPublishError(message),
      publish_lock_until: null,
    })
    .eq('id', item.id);
  await recordAttempt(admin, {
    itemId: item.id,
    orgId: input.orgId,
    clientId: item.client_id,
    platform: item.platform,
    status: 'failed',
    error: message,
    requestedBy: input.requestedBy,
    source: input.source,
  });
}

export async function publishDueCalendarItems(input?: {
  orgId?: string | null;
  clientId?: string | null;
  requestedBy?: string | null;
  source?: 'cron' | 'flush';
  limit?: number;
}) {
  const admin = getSupabaseAdmin();
  const limit = Math.min(Math.max(input?.limit || 6, 1), 12);
  let query = admin
    .from('calendar_items')
    .select('id, client_id, platform, scheduled_at, publish_blocked, provider_post_id')
    .eq('status', 'scheduled')
    .in('platform', ['instagram', 'facebook'])
    .is('provider_post_id', null)
    .eq('publish_blocked', false)
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(24);

  if (input?.clientId) query = query.eq('client_id', input.clientId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const clientIds = [...new Set((data || []).map((row) => row.client_id))];
  const { data: clients } = clientIds.length
    ? await admin.from('clients').select('id, org_id, name').in('id', clientIds)
    : { data: [] as Array<{ id: string; org_id: string; name: string }> };
  const clientMap = new Map((clients || []).map((row) => [row.id, row]));
  const rows = (data || [])
    .map((row) => ({ ...row, org_id: clientMap.get(row.client_id)?.org_id }))
    .filter((row) => {
      if (!row.org_id) return false;
      if (input?.orgId && row.org_id !== input.orgId) return false;
      return true;
    })
    .slice(0, limit);

  const published: Array<Record<string, unknown>> = [];
  const failed: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    try {
      const result = await publishOneCalendarItem({
        itemId: row.id,
        orgId: String(row.org_id),
        requestedBy: input?.requestedBy,
        source: input?.source || 'cron',
      });
      if ((result as any).skipped) continue;
      published.push(result);
    } catch (err: any) {
      failed.push({ itemId: row.id, error: err.message });
    }
  }

  return { success: true, scanned: rows.length, published, failed };
}
