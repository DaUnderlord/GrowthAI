import type { Request, Response } from 'express';
import { getSupabaseAdmin } from '../supabaseAdmin';
import { authOf, requireSupabaseUser } from '../authMiddleware';
import { sendWhatsAppText } from './cloudApi';
import { normalizePhone, resolveAccessToken } from './ingest';
import { heuristicLeadAnalysis, suggestReplyWithGemini } from './aiLead';

type GenerateFn = (prompt: string, system?: string) => Promise<string>;

export { requireSupabaseUser } from '../authMiddleware';

export function registerWhatsAppStaffRoutes(app: any, generateGrowthAI?: GenerateFn) {
  app.get('/api/whatsapp/accounts', requireSupabaseUser, async (req: Request, res: Response) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.json({ success: true, accounts: [] });
        return;
      }
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('whatsapp_accounts')
        .select('id, org_id, client_id, phone_number_id, waba_id, display_phone_number, verified_name, status, webhook_subscribed, created_at')
        .eq('org_id', auth.orgId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      res.json({
        success: true,
        accounts: data || [],
        webhookUrl: `${process.env.APP_URL || 'http://localhost:3000'}/api/meta/webhook`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/whatsapp/accounts', requireSupabaseUser, async (req: Request, res: Response) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: 'Your profile has no organization. Complete onboarding first.' });
        return;
      }
      if (auth.role && !['admin', 'super_admin', 'manager'].includes(auth.role)) {
        res.status(403).json({ success: false, error: 'Only admins/managers can connect WhatsApp accounts.' });
        return;
      }

      const {
        clientId,
        phoneNumberId,
        accessToken,
        wabaId,
        displayPhoneNumber,
        verifiedName,
      } = req.body || {};

      if (!clientId || !phoneNumberId || !accessToken) {
        res.status(400).json({ success: false, error: 'clientId, phoneNumberId, and accessToken are required.' });
        return;
      }

      const admin = getSupabaseAdmin();
      const { data: client } = await admin
        .from('clients')
        .select('id, org_id')
        .eq('id', clientId)
        .maybeSingle();
      if (!client || client.org_id !== auth.orgId) {
        res.status(403).json({ success: false, error: 'Client not found in your organization.' });
        return;
      }

      const { data: account, error } = await admin
        .from('whatsapp_accounts')
        .upsert(
          {
            org_id: auth.orgId,
            client_id: clientId,
            phone_number_id: String(phoneNumberId).trim(),
            waba_id: wabaId || null,
            display_phone_number: displayPhoneNumber || '',
            verified_name: verifiedName || null,
            status: 'connected',
            webhook_subscribed: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'phone_number_id' }
        )
        .select('id, org_id, client_id, phone_number_id, waba_id, display_phone_number, verified_name, status, webhook_subscribed, created_at')
        .single();
      if (error) throw new Error(error.message);

      const { error: secretErr } = await admin.from('whatsapp_account_secrets').upsert({
        account_id: account.id,
        access_token: String(accessToken).trim(),
        updated_at: new Date().toISOString(),
      });
      if (secretErr) throw new Error(secretErr.message);

      res.json({
        success: true,
        account,
        webhookUrl: `${process.env.APP_URL || 'http://localhost:3000'}/api/meta/webhook`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/whatsapp/send', requireSupabaseUser, async (req: Request, res: Response) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: 'No organization on profile.' });
        return;
      }
      const { conversationId, text } = req.body || {};
      if (!conversationId || !text?.trim()) {
        res.status(400).json({ success: false, error: 'conversationId and text are required.' });
        return;
      }

      const admin = getSupabaseAdmin();
      const { data: conversation, error: convErr } = await admin
        .from('conversations')
        .select('*, contacts:contact_id(id, phone, name), whatsapp_accounts:whatsapp_account_id(id, phone_number_id)')
        .eq('id', conversationId)
        .eq('org_id', auth.orgId)
        .maybeSingle();
      if (convErr) throw new Error(convErr.message);
      if (!conversation) {
        res.status(404).json({ success: false, error: 'Conversation not found.' });
        return;
      }

      const phone = normalizePhone((conversation as any).contacts?.phone || '');
      const accountId = conversation.whatsapp_account_id as string | null;
      const phoneNumberId =
        (conversation as any).whatsapp_accounts?.phone_number_id ||
        process.env.WHATSAPP_PHONE_NUMBER_ID;
      if (!phone || !phoneNumberId || !accountId) {
        res.status(400).json({ success: false, error: 'Conversation is missing WhatsApp account or contact phone.' });
        return;
      }

      const token = (await resolveAccessToken(accountId)) || process.env.WHATSAPP_ACCESS_TOKEN;
      if (!token) {
        res.status(400).json({ success: false, error: 'No WhatsApp access token configured for this account.' });
        return;
      }

      const { data: pendingMsg, error: pendingErr } = await admin
        .from('messages')
        .insert({
          org_id: auth.orgId,
          conversation_id: conversationId,
          direction: 'outgoing',
          type: 'text',
          text: text.trim(),
          status: 'pending',
          sender_type: 'agent',
          sender_user_id: auth.userId,
          timestamp: new Date().toISOString(),
        })
        .select('*')
        .single();
      if (pendingErr) throw new Error(pendingErr.message);

      try {
        const sent = await sendWhatsAppText({
          phoneNumberId,
          accessToken: token,
          to: phone,
          text: text.trim(),
        });

        await admin
          .from('messages')
          .update({
            status: 'sent',
            whatsapp_message_id: sent.messageId,
          })
          .eq('id', pendingMsg.id);

        await admin
          .from('conversations')
          .update({
            last_message: text.trim(),
            last_message_at: new Date().toISOString(),
            unread_count: 0,
            updated_at: new Date().toISOString(),
            lead_status:
              conversation.lead_status === 'new' ? 'contacted' : conversation.lead_status,
          })
          .eq('id', conversationId);

        res.json({ success: true, messageId: pendingMsg.id, whatsappMessageId: sent.messageId });
      } catch (sendErr: any) {
        await admin
          .from('messages')
          .update({ status: 'failed', error_message: sendErr.message })
          .eq('id', pendingMsg.id);
        throw sendErr;
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.patch('/api/whatsapp/conversations/:id', requireSupabaseUser, async (req: Request, res: Response) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: 'No organization on profile.' });
        return;
      }
      const id = req.params.id;
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const allowed = [
        'lead_status',
        'assigned_to',
        'notes',
        'priority',
        'status',
        'lead_value',
        'expected_revenue',
        'actual_revenue',
        'lost_reason',
        'campaign_id',
        'unread_count',
        'tags',
      ];
      for (const key of allowed) {
        if (req.body?.[key] !== undefined) patch[key] = req.body[key];
      }

      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('conversations')
        .update(patch)
        .eq('id', id)
        .eq('org_id', auth.orgId)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      res.json({ success: true, conversation: data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/whatsapp/ai/suggest-reply', requireSupabaseUser, async (req: Request, res: Response) => {
    try {
      const { customerMessage, history, clientName } = req.body || {};
      if (!customerMessage) {
        res.status(400).json({ success: false, error: 'customerMessage is required.' });
        return;
      }
      const suggestion = generateGrowthAI
        ? await suggestReplyWithGemini({ customerMessage, history, clientName }, generateGrowthAI)
        : `Thanks for reaching out. ${heuristicLeadAnalysis(customerMessage).recommendedAction === 'assign_sales_manager' ? "I'll have a specialist confirm pricing and availability for you." : "I'll get the details and reply shortly."}`;
      res.json({ success: true, suggestion });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
}
