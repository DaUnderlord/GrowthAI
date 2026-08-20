import { getSupabaseAdmin } from '../supabaseAdmin';
import { analyzeLeadWithGemini, heuristicLeadAnalysis, LeadAnalysis } from './aiLead';

type GenerateFn = (prompt: string, system?: string) => Promise<string>;

function normalizePhone(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

function extractText(message: any): { type: string; text: string | null; payload: Record<string, unknown> } {
  const type = message?.type || 'text';
  if (type === 'text') {
    return { type, text: message?.text?.body || null, payload: message };
  }
  if (type === 'button') {
    return { type, text: message?.button?.text || message?.button?.payload || null, payload: message };
  }
  if (type === 'interactive') {
    const reply =
      message?.interactive?.button_reply?.title ||
      message?.interactive?.list_reply?.title ||
      null;
    return { type, text: reply, payload: message };
  }
  if (type === 'image') {
    return { type, text: message?.image?.caption || '[Image]', payload: message };
  }
  if (type === 'audio') return { type, text: '[Audio]', payload: message };
  if (type === 'video') return { type, text: message?.video?.caption || '[Video]', payload: message };
  if (type === 'document') return { type, text: message?.document?.filename || '[Document]', payload: message };
  if (type === 'location') return { type, text: '[Location]', payload: message };
  return { type, text: `[${type}]`, payload: message };
}

function extractReferral(message: any): Record<string, unknown> {
  const referral = message?.referral;
  if (!referral) return {};
  return {
    source_url: referral.source_url,
    source_type: referral.source_type,
    source_id: referral.source_id,
    headline: referral.headline,
    body: referral.body,
    media_type: referral.media_type,
    ctwa_clid: referral.ctwa_clid,
    image_url: referral.image_url,
  };
}

async function resolveAccessToken(accountId: string): Promise<string | null> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from('whatsapp_account_secrets')
    .select('access_token')
    .eq('account_id', accountId)
    .maybeSingle();
  if (data?.access_token) return data.access_token as string;
  return process.env.WHATSAPP_ACCESS_TOKEN || null;
}

export async function findAccountByPhoneNumberId(phoneNumberId: string) {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('whatsapp_accounts')
    .select('*')
    .eq('phone_number_id', phoneNumberId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (data) return data;

  // Env bootstrap: map WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_BOOTSTRAP_CLIENT_ID
  const envPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const bootstrapClientId = process.env.WHATSAPP_BOOTSTRAP_CLIENT_ID;
  if (envPhoneId && phoneNumberId === envPhoneId && bootstrapClientId) {
    const { data: client } = await db.from('clients').select('id, org_id, name').eq('id', bootstrapClientId).maybeSingle();
    if (!client?.org_id) return null;
    const { data: created, error: createErr } = await db
      .from('whatsapp_accounts')
      .upsert(
        {
          org_id: client.org_id,
          client_id: client.id,
          phone_number_id: phoneNumberId,
          display_phone_number: process.env.WHATSAPP_DISPLAY_NUMBER || '',
          status: 'connected',
          webhook_subscribed: true,
        },
        { onConflict: 'phone_number_id' }
      )
      .select('*')
      .single();
    if (createErr) throw new Error(createErr.message);
    if (process.env.WHATSAPP_ACCESS_TOKEN) {
      await db.from('whatsapp_account_secrets').upsert({
        account_id: created.id,
        access_token: process.env.WHATSAPP_ACCESS_TOKEN,
        updated_at: new Date().toISOString(),
      });
    }
    return created;
  }

  return null;
}

async function persistAnalysis(
  orgId: string,
  conversationId: string,
  messageId: string | null,
  analysis: LeadAnalysis
) {
  const db = getSupabaseAdmin();
  await db.from('conversation_ai_analyses').insert({
    org_id: orgId,
    conversation_id: conversationId,
    message_id: messageId,
    analysis,
  });

  const priority = analysis.classification === 'high_intent' ? 'high' : analysis.classification === 'medium_intent' ? 'normal' : 'low';
  await db
    .from('conversations')
    .update({
      lead_score: analysis.score,
      priority,
      ai_summary: analysis.summary,
      recommended_action: analysis.recommendedAction,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);
}

export async function ingestWhatsAppWebhookPayload(
  body: any,
  generateGrowthAI?: GenerateFn
): Promise<{ processed: number }> {
  const db = getSupabaseAdmin();
  let processed = 0;
  const entries = body?.entry || [];

  for (const entry of entries) {
    for (const change of entry?.changes || []) {
      if (change?.field && change.field !== 'messages') continue;
      const value = change?.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const account = await findAccountByPhoneNumberId(phoneNumberId);
      if (!account) {
        console.warn('No WhatsApp account mapped for phone_number_id', phoneNumberId);
        continue;
      }

      // Status updates
      for (const status of value?.statuses || []) {
        const waId = status?.id;
        if (!waId) continue;
        const mapped =
          status.status === 'sent'
            ? 'sent'
            : status.status === 'delivered'
              ? 'delivered'
              : status.status === 'read'
                ? 'read'
                : status.status === 'failed'
                  ? 'failed'
                  : null;
        if (!mapped) continue;
        await db
          .from('messages')
          .update({
            status: mapped,
            error_message: status?.errors?.[0]?.title || null,
          })
          .eq('whatsapp_message_id', waId);
        processed += 1;
      }

      // Inbound messages
      for (const message of value?.messages || []) {
        const from = normalizePhone(message?.from);
        if (!from) continue;

        const contactProfile = (value?.contacts || []).find(
          (c: any) => normalizePhone(c?.wa_id) === from
        );
        const displayName = contactProfile?.profile?.name || from;
        const { type, text, payload } = extractText(message);
        const referral = extractReferral(message);
        const waMessageId = message?.id;
        const ts = message?.timestamp
          ? new Date(Number(message.timestamp) * 1000).toISOString()
          : new Date().toISOString();

        if (waMessageId) {
          const { data: existing } = await db
            .from('messages')
            .select('id')
            .eq('whatsapp_message_id', waMessageId)
            .maybeSingle();
          if (existing) continue;
        }

        const { data: contact, error: contactErr } = await db
          .from('contacts')
          .upsert(
            {
              org_id: account.org_id,
              client_id: account.client_id,
              phone: from,
              whatsapp_id: from,
              name: displayName,
              source: referral.source_type || 'whatsapp',
              meta_referral: referral,
              last_interaction_at: ts,
              updated_at: ts,
            },
            { onConflict: 'org_id,phone' }
          )
          .select('*')
          .single();
        if (contactErr) throw new Error(contactErr.message);

        let conversationId: string | null = null;
        const { data: openConv } = await db
          .from('conversations')
          .select('*')
          .eq('org_id', account.org_id)
          .eq('contact_id', contact.id)
          .eq('channel', 'whatsapp')
          .in('status', ['open', 'pending'])
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (openConv) {
          conversationId = openConv.id;
          await db
            .from('conversations')
            .update({
              last_message: text || `[${type}]`,
              last_message_at: ts,
              unread_count: (openConv.unread_count || 0) + 1,
              whatsapp_account_id: account.id,
              meta_attribution: Object.keys(referral).length
                ? { ...((openConv.meta_attribution as object) || {}), ...referral }
                : openConv.meta_attribution,
              updated_at: ts,
            })
            .eq('id', openConv.id);
        } else {
          const { data: createdConv, error: convErr } = await db
            .from('conversations')
            .insert({
              org_id: account.org_id,
              client_id: account.client_id,
              contact_id: contact.id,
              whatsapp_account_id: account.id,
              channel: 'whatsapp',
              status: 'open',
              lead_status: 'new',
              last_message: text || `[${type}]`,
              last_message_at: ts,
              unread_count: 1,
              meta_attribution: referral,
            })
            .select('*')
            .single();
          if (convErr) throw new Error(convErr.message);
          conversationId = createdConv.id;

          if (Object.keys(referral).length) {
            await db.from('campaign_leads').insert({
              org_id: account.org_id,
              client_id: account.client_id,
              contact_id: contact.id,
              conversation_id: conversationId,
              source: String(referral.source_type || 'whatsapp'),
              meta_source_id: referral.source_id ? String(referral.source_id) : null,
              meta_attribution: referral,
              status: 'new',
            });
          }
        }

        const { data: savedMsg, error: msgErr } = await db
          .from('messages')
          .insert({
            org_id: account.org_id,
            conversation_id: conversationId,
            direction: 'incoming',
            type,
            text,
            payload,
            whatsapp_message_id: waMessageId,
            status: 'received',
            sender_type: 'customer',
            timestamp: ts,
          })
          .select('*')
          .single();
        if (msgErr) throw new Error(msgErr.message);

        if (text) {
          const analysis = generateGrowthAI
            ? await analyzeLeadWithGemini(text, generateGrowthAI)
            : heuristicLeadAnalysis(text);
          await persistAnalysis(account.org_id, conversationId!, savedMsg.id, analysis);
        }

        processed += 1;
      }
    }
  }

  return { processed };
}

export { resolveAccessToken, normalizePhone };
