import type { Express, Request, Response } from 'express';
import { getSupabaseAdmin } from '../supabaseAdmin';
import { authOf, requireSupabaseUser } from '../authMiddleware';
import { getAppUrl } from '../appUrl';
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchGrantedMetaScopes,
  fetchLiveStats,
  providerConfig,
  resolveOAuthRedirectUri,
} from './providers';
import { rebuildClientInsights } from '../insightsEngine';
import {
  familyForPlatform,
  getAllOrgProviderStatus,
  getOrgFamilyCreds,
  getOrgMetaCreds,
  saveOrgFamilyCreds,
  saveOrgMetaCreds,
  type ProviderFamily,
} from '../orgIntegrations';
import type { ProviderOverrideMap } from './providers';
import { hasMetaPublishScopes, publishReadyNote } from '../../shared/calendarPublish';

async function overridesForOrg(orgId?: string | null): Promise<ProviderOverrideMap> {
  const families: ProviderFamily[] = ['meta', 'google', 'tiktok', 'linkedin'];
  const map: ProviderOverrideMap = {};
  for (const family of families) {
    const creds = await getOrgFamilyCreds(orgId, family);
    if (creds.configured) {
      map[family] = { clientId: creds.clientId, secret: creds.secret, extra: creds.extra };
    }
  }
  return map;
}

function maskToken(token?: string | null) {
  if (!token) return undefined;
  if (token.length < 10) return '••••';
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

async function assertClientInOrg(clientId: string, orgId: string) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from('clients').select('id, org_id').eq('id', clientId).maybeSingle();
  if (error || !data || data.org_id !== orgId) throw new Error('Client not found in your organization.');
  return data;
}

export function registerSocialRoutes(app: Express) {
  app.get('/api/org/meta', requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      const creds = await getOrgMetaCreds(auth.orgId);
      res.json({
        success: true,
        configured: creds.configured,
        source: creds.source,
        appId: creds.appId ? `${creds.appId.slice(0, 4)}…` : '',
        verifyToken: creds.verifyToken,
        redirectUri: resolveOAuthRedirectUri(undefined, req.get('origin'), req.get('referer')),
        webhookUrl: `${getAppUrl()}/api/meta/webhook`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/org/meta', requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: 'Complete workspace onboarding first.' });
        return;
      }
      if (auth.role && !['admin', 'super_admin', 'manager'].includes(auth.role)) {
        res.status(403).json({ success: false, error: 'Only admins can connect Meta.' });
        return;
      }
      const { appId, appSecret, verifyToken, configId } = req.body || {};
      if (!appId) {
        res.status(400).json({ success: false, error: 'Meta App ID is required.' });
        return;
      }
      const saved = await saveOrgMetaCreds(auth.orgId, { appId, appSecret, verifyToken, configId });
      res.json({ success: true, ...saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/org/providers', requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      const families = await getAllOrgProviderStatus(auth.orgId);
      res.json({
        success: true,
        families,
        redirectUri: resolveOAuthRedirectUri(undefined, req.get('origin'), req.get('referer')),
        webhookUrl: `${getAppUrl()}/api/meta/webhook`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/org/providers', requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: 'Complete workspace onboarding first.' });
        return;
      }
      if (auth.role && !['admin', 'super_admin', 'manager'].includes(auth.role)) {
        res.status(403).json({ success: false, error: 'Only admins can save provider apps.' });
        return;
      }
      const family = String(req.body?.family || '') as ProviderFamily;
      if (!['meta', 'google', 'tiktok', 'linkedin'].includes(family)) {
        res.status(400).json({ success: false, error: 'family must be meta, google, tiktok, or linkedin.' });
        return;
      }
      const saved = await saveOrgFamilyCreds(auth.orgId, family, {
        clientId: req.body?.clientId || req.body?.appId,
        clientSecret: req.body?.clientSecret || req.body?.appSecret,
        verifyToken: req.body?.verifyToken,
        developerToken: req.body?.developerToken,
        customerId: req.body?.customerId,
        configId: req.body?.configId,
      });
      res.json({ success: true, ...saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/socials/status', requireSupabaseUser, async (req, res) => {
    const auth = authOf(req);
    const overrides = await overridesForOrg(auth.orgId);
    const platforms = [
      'instagram',
      'facebook',
      'meta_ads',
      'youtube',
      'google_analytics',
      'google_ads',
      'linkedin',
      'tiktok',
    ];
    res.json({
      success: true,
      families: await getAllOrgProviderStatus(auth.orgId),
      providers: Object.fromEntries(
        platforms.map((p) => {
          try {
            return [p, { configured: providerConfig(p, overrides).configured, family: familyForPlatform(p) }];
          } catch {
            return [p, { configured: false, family: familyForPlatform(p) }];
          }
        })
      ),
    });
  });

  app.get('/api/auth/:platform/url', requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      const platform = String(req.params.platform);
      const clientId = String(req.query.clientId || '');
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: 'Complete onboarding first.' });
        return;
      }
      if (!clientId) {
        res.status(400).json({ success: false, error: 'clientId is required.' });
        return;
      }
      await assertClientInOrg(clientId, auth.orgId);
      const preferredAccount = String(req.query.preferredAccount || req.query.handle || '')
        .trim()
        .replace(/^@/, '')
        .slice(0, 80);
      const state = `${platform}_${crypto.randomUUID()}${
        preferredAccount ? `__acc_${encodeURIComponent(preferredAccount)}` : ''
      }`;
      const redirectUri = resolveOAuthRedirectUri(
        String(req.query.redirectUri || ''),
        req.get('origin'),
        req.get('referer')
      );
      const openerOrigin = String(req.get('origin') || new URL(redirectUri).origin).replace(/\/$/, '');
      const admin = getSupabaseAdmin();
      await admin.from('oauth_states').insert({
        state,
        user_id: auth.userId,
        org_id: auth.orgId,
        client_id: clientId,
        platform,
        redirect_origin: openerOrigin,
        redirect_uri: redirectUri,
      });
      const overrides = await overridesForOrg(auth.orgId);
      const url = buildAuthorizeUrl(platform, state, overrides, redirectUri);
      const metaId = overrides.meta?.clientId || '';
      const metaConfigId = String(overrides.meta?.extra?.configId || '').trim();
      console.info('[oauth] authorize url ready', {
        platform,
        orgId: auth.orgId,
        clientId,
        redirectUri,
        preferredAccount: preferredAccount || null,
        metaAppIdLen: metaId.length,
        metaAppIdNumeric: /^\d+$/.test(metaId),
        metaConfigIdLen: metaConfigId.length,
        metaLoginForBusiness: Boolean(metaConfigId),
        authorizeHasScope: /[?&]scope=/.test(url),
      });
      res.json({ success: true, platform, url, externalUrl: url, mock: false });
    } catch (err: any) {
      console.warn('[oauth] authorize url failed', err?.message);
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/socials/connect', requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: 'Complete onboarding first.' });
        return;
      }
      const { clientId, platform, accessToken } = req.body || {};
      if (!clientId || !platform || !accessToken) {
        res.status(400).json({ success: false, error: 'clientId, platform, and accessToken are required.' });
        return;
      }
      await assertClientInOrg(String(clientId), auth.orgId);
      const extras = { ...(await getOrgFamilyCreds(auth.orgId, familyForPlatform(String(platform)))).extra };
      const { data: client } = await getSupabaseAdmin().from('clients').select('name').eq('id', clientId).maybeSingle();
      if (client?.name) extras.clientName = client.name;
      let stats;
      let lastError: string | null = null;
      try {
        stats = await fetchLiveStats(String(platform), String(accessToken).trim(), extras);
      } catch (err: any) {
        lastError = err.message;
        stats = emptyStats(String(platform), lastError);
      }
      const token = String(accessToken).trim();
      const scopes = ['instagram', 'facebook', 'meta_ads'].includes(String(platform))
        ? await fetchGrantedMetaScopes(token).catch(() => '')
        : undefined;
      const connection = await upsertConnection({
        orgId: auth.orgId,
        clientId: String(clientId),
        platform: String(platform),
        stats,
        accessToken: token,
        scopes,
        lastError,
      });
      await rebuildClientInsights(String(clientId), auth.orgId);
      res.json({ success: true, connection, oauthTokenMasked: maskToken(accessToken) });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/socials/bind', requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: 'Complete onboarding first.' });
        return;
      }
      const { clientId, platform, externalId } = req.body || {};
      if (!clientId || !platform || !externalId) {
        res.status(400).json({ success: false, error: 'clientId, platform, and externalId are required.' });
        return;
      }
      await assertClientInOrg(String(clientId), auth.orgId);
      const admin = getSupabaseAdmin();
      const { data: connection } = await admin
        .from('social_connections')
        .select('id, ad_account_id')
        .eq('org_id', auth.orgId)
        .eq('client_id', clientId)
        .eq('platform', platform)
        .maybeSingle();
      if (!connection) {
        res.status(400).json({ success: false, error: 'Sign in with Meta first, then choose the brand account.' });
        return;
      }
      const { data: secret } = await admin
        .from('social_connection_secrets')
        .select('access_token')
        .eq('connection_id', connection.id)
        .maybeSingle();
      if (!secret?.access_token) {
        res.status(400).json({ success: false, error: 'Saved Meta token is missing. Sign in again.' });
        return;
      }
      const extras = {
        ...(await getOrgFamilyCreds(auth.orgId, familyForPlatform(String(platform)))).extra,
        externalId: String(externalId),
        adAccountId: connection.ad_account_id || '',
      };
      const stats = await fetchLiveStats(String(platform), secret.access_token, extras);
      const saved = await upsertConnection({
        orgId: auth.orgId,
        clientId: String(clientId),
        platform: String(platform),
        stats,
        accessToken: secret.access_token,
      });
      await rebuildClientInsights(String(clientId), auth.orgId);
      res.json({ success: true, connection: saved });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.get('/api/socials/connections', requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.json({ success: true, connections: [] });
        return;
      }
      const clientId = String(req.query.clientId || '');
      const admin = getSupabaseAdmin();
      let q = admin.from('social_connections').select('*').eq('org_id', auth.orgId);
      if (clientId) q = q.eq('client_id', clientId);
      const { data, error } = await q.order('updated_at', { ascending: false });
      if (error) throw new Error(error.message);
      const ids = (data || []).map((row: any) => row.id);
      const { data: secrets } = ids.length
        ? await admin.from('social_connection_secrets').select('connection_id, scopes').in('connection_id', ids)
        : { data: [] as Array<{ connection_id: string; scopes: string | null }> };
      const scopeMap = new Map((secrets || []).map((row) => [row.connection_id, row.scopes]));
      const connections = (data || []).map((row: any) => {
        const scopes = scopeMap.get(row.id) || '';
        const canPublish = hasMetaPublishScopes(row.platform, scopes);
        return {
          ...row,
          can_publish: canPublish,
          publish_ready_note: publishReadyNote(row.platform, scopes, true),
        };
      });
      res.json({ success: true, connections });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/socials/sync', requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: 'Complete onboarding first.' });
        return;
      }
      const { clientId, platform } = req.body || {};
      if (!clientId) {
        res.status(400).json({ success: false, error: 'clientId is required.' });
        return;
      }
      await assertClientInOrg(String(clientId), auth.orgId);
      const admin = getSupabaseAdmin();
      let q = admin.from('social_connections').select('id, platform, external_id, ad_account_id').eq('org_id', auth.orgId).eq('client_id', clientId);
      if (platform) q = q.eq('platform', platform);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      if (!rows?.length) {
        res.status(400).json({ success: false, error: 'No connected social accounts to sync.' });
        return;
      }

      const synced = [];
      for (const row of rows) {
        const { data: secret } = await admin
          .from('social_connection_secrets')
          .select('access_token')
          .eq('connection_id', row.id)
          .maybeSingle();
        if (!secret?.access_token) continue;
        try {
          const extras = {
            ...(await getOrgFamilyCreds(auth.orgId, familyForPlatform(row.platform))).extra,
            externalId: row.external_id || '',
            adAccountId: row.ad_account_id || '',
          };
          const stats = await fetchLiveStats(row.platform, secret.access_token, extras);
          const scopes = ['instagram', 'facebook', 'meta_ads'].includes(row.platform)
            ? await fetchGrantedMetaScopes(secret.access_token).catch(() => undefined)
            : undefined;
          const connection = await upsertConnection({
            orgId: auth.orgId,
            clientId: String(clientId),
            platform: row.platform,
            stats,
            accessToken: secret.access_token,
            scopes,
          });
          synced.push(connection);
        } catch (err: any) {
          await admin
            .from('social_connections')
            .update({ last_error: err.message, status: 'error', updated_at: new Date().toISOString() })
            .eq('id', row.id);
        }
      }

      const insights = await rebuildClientInsights(String(clientId), auth.orgId);
      res.json({ success: true, synced, insights });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/socials/connections/:id', requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: 'No organization.' });
        return;
      }
      const admin = getSupabaseAdmin();
      const { error } = await admin
        .from('social_connections')
        .delete()
        .eq('id', req.params.id)
        .eq('org_id', auth.orgId);
      if (error) throw new Error(error.message);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get(['/auth/callback', '/auth/callback/', '/api/auth/callback', '/api/auth/callback/'], async (req: Request, res: Response) => {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    const fallbackOrigin = getAppUrl().replace(/\/$/, '');
    let openerOrigin = fallbackOrigin;
    try {
      if (!code || !state) throw new Error('Missing OAuth code or state.');
      const admin = getSupabaseAdmin();
      const { data: row } = await admin.from('oauth_states').select('*').eq('state', state).maybeSingle();
      if (!row || new Date(row.expires_at).getTime() < Date.now()) {
        throw new Error('OAuth state expired. Start the connection again.');
      }
      openerOrigin = String(row.redirect_origin || fallbackOrigin).replace(/\/$/, '');
      const redirectUri = resolveOAuthRedirectUri(row.redirect_uri, row.redirect_origin);
      console.info('[oauth] callback exchange', { platform: row.platform, redirectUri, openerOrigin });
      const overrides = await overridesForOrg(row.org_id);
      const tokens = await exchangeCodeForToken(row.platform, code, overrides, redirectUri);
      const extras = { ...(await getOrgFamilyCreds(row.org_id, familyForPlatform(row.platform))).extra };
      const { data: client } = await admin.from('clients').select('name').eq('id', row.client_id).maybeSingle();
      const preferredMatch = String(row.state || '').match(/__acc_(.+)$/);
      const preferredAccount = preferredMatch ? decodeURIComponent(preferredMatch[1]) : '';
      if (/^\d{5,}$/.test(preferredAccount)) extras.externalId = preferredAccount;
      else if (preferredAccount) extras.clientName = preferredAccount;
      else if (client?.name) extras.clientName = client.name;
      let stats;
      let lastError: string | null = null;
      let needsSelection: any[] | undefined;
      try {
        stats = await fetchLiveStats(row.platform, tokens.accessToken, extras);
      } catch (err: any) {
        lastError = err.message;
        if (err.code === 'NEEDS_SELECTION') needsSelection = err.assets;
        stats = emptyStats(row.platform, lastError);
      }
      await upsertConnection({
        orgId: row.org_id,
        clientId: row.client_id,
        platform: row.platform,
        stats,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        lastError,
        status: needsSelection ? 'needs_selection' : undefined,
      });
      await rebuildClientInsights(row.client_id, row.org_id);
      await admin.from('oauth_states').delete().eq('id', row.id);
      const canPublish =
        (row.platform === 'instagram' || row.platform === 'facebook') &&
        hasMetaPublishScopes(row.platform, tokens.scopes);
      const publishWarning =
        (row.platform === 'instagram' || row.platform === 'facebook') && !canPublish
          ? 'Signed in, but Meta did not grant publishing. Add instagram_content_publish and pages_manage_posts to your Facebook Login for Business configuration, then reconnect and accept those permissions.'
          : undefined;
      res.send(
        callbackPage(openerOrigin, {
          ok: true,
          platform: row.platform,
          accountName: stats.accountName,
          warning: lastError || publishWarning,
          canPublish,
          needsSelection,
        })
      );
    } catch (err: any) {
      console.error('[oauth] callback failed', err?.message);
      res.status(400).send(callbackPage(openerOrigin, { ok: false, error: err.message }));
    }
  });
}

function emptyStats(platform: string, note: string) {
  return {
    accountName: platform,
    followers: 0,
    growthRate: 0,
    healthScore: 0,
    impressions24h: 0,
    reach24h: 0,
    engagement24h: 0,
    clicks24h: 0,
    spend30d: 0,
    conversions30d: 0,
    revenue30d: 0,
    demographics: { note },
  };
}

async function upsertConnection(input: {
  orgId: string;
  clientId: string;
  platform: string;
  stats: Awaited<ReturnType<typeof fetchLiveStats>>;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string | null;
  scopes?: string;
  lastError?: string | null;
  status?: 'connected' | 'error' | 'needs_selection';
}) {
  const admin = getSupabaseAdmin();
  const { data: connection, error } = await admin
    .from('social_connections')
    .upsert(
      {
        org_id: input.orgId,
        client_id: input.clientId,
        platform: input.platform,
        account_name: input.stats.accountName,
        external_id: input.stats.externalId || null,
        ad_account_id: input.stats.adAccountId || null,
        status: input.status || (input.lastError ? 'error' : 'connected'),
        followers: input.stats.followers,
        growth_rate: input.stats.growthRate,
        health_score: input.stats.healthScore,
        impressions_24h: input.stats.impressions24h,
        reach_24h: input.stats.reach24h,
        engagement_24h: input.stats.engagement24h,
        clicks_24h: input.stats.clicks24h,
        spend_30d: input.stats.spend30d,
        conversions_30d: input.stats.conversions30d,
        revenue_30d: input.stats.revenue30d,
        last_sync: new Date().toISOString(),
        last_error: input.lastError || null,
        posts: input.stats.posts || [],
        demographics: input.stats.demographics || {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id,platform' }
    )
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  const secretRow: Record<string, unknown> = {
    connection_id: connection.id,
    access_token: input.accessToken,
    updated_at: new Date().toISOString(),
  };
  if (input.refreshToken !== undefined) secretRow.refresh_token = input.refreshToken || null;
  if (input.expiresAt !== undefined) secretRow.token_expires_at = input.expiresAt || null;
  if (input.scopes !== undefined) secretRow.scopes = input.scopes || null;

  const { error: secretErr } = await admin.from('social_connection_secrets').upsert(secretRow);
  if (secretErr) throw new Error(secretErr.message);
  return connection;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function callbackPage(origin: string, payload: Record<string, unknown>) {
  const message = payload.ok ? 'Account connected. Returning to GrowthOS…' : String(payload.error || 'OAuth failed');
  const next = `${origin}/?view=agency&oauth=${payload.ok ? 'ok' : 'error'}&platform=${encodeURIComponent(String(payload.platform || ''))}`;
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#070b12;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh">
  <p>${escapeHtml(message)}</p>
  <script>
    var payload = Object.assign({ type: ${JSON.stringify(payload.ok ? 'OAUTH_AUTH_SUCCESS' : 'OAUTH_AUTH_ERROR')} }, ${JSON.stringify(payload)});
    try { sessionStorage.setItem('gos_oauth', JSON.stringify(payload)); } catch (e) {}
    if (window.opener) {
      window.opener.postMessage(payload, ${JSON.stringify(origin)});
      setTimeout(function () { window.close(); }, 800);
    } else {
      location.replace(${JSON.stringify(next)});
    }
  </script></body></html>`;
}
