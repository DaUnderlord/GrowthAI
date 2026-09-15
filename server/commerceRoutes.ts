import type { Express, Request, Response } from 'express';
import express from 'express';
import { getSupabaseAdmin } from './supabaseAdmin';
import { authOf, requireSupabaseUser } from './authMiddleware';
import { sendTransactionalEmail, isEmailConfigured } from './email';
import {
  createInvoiceCheckout,
  createSubscriptionCheckout,
  isStripeConfigured,
  listBillingTiers,
  verifyStripeSignature,
} from './stripeBilling';
import { getAppUrl } from './appUrl';
import { campaignMetricsFromInsights } from './insightsEngine';
import { createMetaBoost } from './social/providers';
import { generateGrowthAI } from './ai/gemini';
import { loadLiveAccountContext, withLiveAccountRules, withLiveAccountUser } from './ai/liveContext';

export function registerCommerceRoutes(app: Express) {
  app.get('/api/invoices', requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.json({ success: true, invoices: [] });
        return;
      }
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('invoices')
        .select('*')
        .eq('org_id', auth.orgId)
        .order('issued_at', { ascending: false });
      if (error) throw new Error(error.message);
      res.json({ success: true, invoices: data || [], emailConfigured: isEmailConfigured(), stripeConfigured: isStripeConfigured() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/invoices', requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: 'Complete onboarding first.' });
        return;
      }
      const { clientId, clientName, clientEmail, amount, currency, description, dueDate } = req.body || {};
      if (!clientId || !amount) {
        res.status(400).json({ success: false, error: 'clientId and amount are required.' });
        return;
      }
      const admin = getSupabaseAdmin();
      const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      const { data: invoice, error } = await admin
        .from('invoices')
        .insert({
          org_id: auth.orgId,
          client_id: clientId,
          invoice_number: invoiceNumber,
          client_name: clientName || 'Client',
          client_email: clientEmail || null,
          amount: Number(amount),
          currency: currency || 'USD',
          description: description || 'Growth services',
          due_date: dueDate || null,
          status: 'outstanding',
          created_by: auth.userId,
        })
        .select('*')
        .single();
      if (error) throw new Error(error.message);

      let emailSent = false;
      if (clientEmail && isEmailConfigured()) {
        await sendTransactionalEmail({
          to: clientEmail,
          subject: `Invoice ${invoiceNumber} from GrowthOS`,
          html: `<p>Hi,</p><p>Invoice <strong>${invoiceNumber}</strong> for ${amount} ${currency || 'USD'} is ready.</p><p>${description || ''}</p><p>Payment collection is paused — settle this invoice offline.</p>`,
        });
        await admin.from('invoices').update({ email_sent_at: new Date().toISOString() }).eq('id', invoice.id);
        emailSent = true;
      }

      res.json({
        success: true,
        invoice,
        emailSent,
        checkoutUrl: null,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.patch('/api/invoices/:id', requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: 'Complete onboarding first.' });
        return;
      }
      const status = String(req.body?.status || '');
      if (status !== 'paid' && status !== 'outstanding') {
        res.status(400).json({ success: false, error: 'status must be paid or outstanding.' });
        return;
      }
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('invoices')
        .update({
          status,
          paid_at: status === 'paid' ? new Date().toISOString() : null,
        })
        .eq('id', req.params.id)
        .eq('org_id', auth.orgId)
        .select('*')
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) {
        res.status(404).json({ success: false, error: 'Invoice not found.' });
        return;
      }
      res.json({ success: true, invoice: data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/invoices/:id', requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: 'Complete onboarding first.' });
        return;
      }
      const admin = getSupabaseAdmin();
      const { error } = await admin.from('invoices').delete().eq('id', req.params.id).eq('org_id', auth.orgId);
      if (error) throw new Error(error.message);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/team/invite', requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      const { email, name } = req.body || {};
      if (!email) {
        res.status(400).json({ success: false, error: 'email is required.' });
        return;
      }
      if (!isEmailConfigured()) {
        res.json({
          success: true,
          emailed: false,
          warning: 'Invite saved. Set RESEND_API_KEY and EMAIL_FROM to send the email automatically.',
        });
        return;
      }
      const appUrl = getAppUrl().replace(/\/$/, '');
      await sendTransactionalEmail({
        to: String(email).trim(),
        subject: `You're invited to GrowthOS`,
        html: `<p>Hi ${name || ''},</p><p>You've been invited to a GrowthOS workspace.</p><p><a href="${appUrl}/?view=overview">Create your account with this email</a> to join.</p>`,
      });
      res.json({ success: true, emailed: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/billing/tiers', requireSupabaseUser, async (_req, res) => {
    res.json({
      success: true,
      tiers: listBillingTiers(),
      stripeConfigured: isStripeConfigured(),
    });
  });

  app.get('/api/billing/status', requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.json({ success: true, billingTier: 'starter', billingStatus: 'inactive' });
        return;
      }
      const admin = getSupabaseAdmin();
      const { data } = await admin
        .from('organizations')
        .select('billing_tier, billing_status, custom_domain, domain_verified')
        .eq('id', auth.orgId)
        .maybeSingle();
      res.json({ success: true, ...(data || {}) });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/billing/checkout', requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: 'Complete onboarding first.' });
        return;
      }
      const tier = String(req.body?.tier || 'growth');
      if (tier === 'starter') {
        const admin = getSupabaseAdmin();
        await admin
          .from('organizations')
          .update({ billing_tier: 'starter', billing_status: 'active' })
          .eq('id', auth.orgId);
        res.json({ success: true, free: true });
        return;
      }
      if (!isStripeConfigured()) {
        res.status(400).json({ success: false, error: 'Set STRIPE_SECRET_KEY to enable paid billing.' });
        return;
      }
      const session = await createSubscriptionCheckout({
        orgId: auth.orgId,
        tier,
        customerEmail: auth.email,
      });
      res.json({ success: true, url: session.url });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/org/domain', requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: 'Complete onboarding first.' });
        return;
      }
      const domain = String(req.body?.domain || '')
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '');
      if (!domain) {
        res.status(400).json({ success: false, error: 'domain is required.' });
        return;
      }
      const token = `growthos-verify=${auth.orgId}`;
      const admin = getSupabaseAdmin();
      await admin
        .from('organizations')
        .update({ custom_domain: domain, domain_verify_token: token, domain_verified: false })
        .eq('id', auth.orgId);

      if (process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID) {
        await fetch(`https://api.vercel.com/v10/projects/${process.env.VERCEL_PROJECT_ID}/domains`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: domain }),
        }).catch(() => undefined);
      }

      res.json({
        success: true,
        domain,
        txtRecord: { host: domain, value: token },
        cname: { host: domain, value: 'cname.vercel-dns.com' },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/org/domain/verify', requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: 'Complete onboarding first.' });
        return;
      }
      const admin = getSupabaseAdmin();
      const { data: org } = await admin
        .from('organizations')
        .select('custom_domain, domain_verify_token')
        .eq('id', auth.orgId)
        .maybeSingle();
      if (!org?.custom_domain || !org.domain_verify_token) {
        res.status(400).json({ success: false, error: 'Save a domain first.' });
        return;
      }
      const lookup = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(org.custom_domain)}&type=TXT`,
        { headers: { Accept: 'application/dns-json' } }
      );
      const dns = await lookup.json();
      const answers = (dns.Answer || []).map((a: any) => String(a.data || '').replace(/"/g, ''));
      const verified = answers.some((txt: string) => txt.includes(org.domain_verify_token));
      await admin.from('organizations').update({ domain_verified: verified }).eq('id', auth.orgId);
      res.json({ success: true, verified, answers });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/campaigns/seed-metrics', requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: 'No organization.' });
        return;
      }
      const { clientId, budget } = req.body || {};
      const admin = getSupabaseAdmin();
      const { data } = await admin
        .from('client_live_insights')
        .select('*')
        .eq('client_id', clientId)
        .eq('org_id', auth.orgId)
        .maybeSingle();
      res.json({ success: true, ...campaignMetricsFromInsights(data, Number(budget) || 0), hasLiveData: Boolean(data && data.source === 'live_sync') });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/insights/:clientId', requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.json({ success: true, insights: null });
        return;
      }
      const admin = getSupabaseAdmin();
      const { data } = await admin
        .from('client_live_insights')
        .select('*')
        .eq('client_id', req.params.clientId)
        .eq('org_id', auth.orgId)
        .maybeSingle();
      res.json({ success: true, insights: data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/growth/reboost', requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.json({ success: true, jobs: [] });
        return;
      }
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('reboost_jobs')
        .select('*')
        .eq('org_id', auth.orgId)
        .eq('client_id', String(req.query.clientId || ''))
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      res.json({ success: true, jobs: data || [] });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/growth/reboost', requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: 'No organization.' });
        return;
      }
      const { clientId, post, budget } = req.body || {};
      if (!clientId || !post) {
        res.status(400).json({ success: false, error: 'clientId and post are required.' });
        return;
      }
      const live = await loadLiveAccountContext(auth.orgId, clientId);
      console.info('[ai] live context', {
        path: '/api/growth/reboost',
        orgId: auth.orgId,
        clientId,
        hasLive: live.hasLive,
        accounts: live.accounts.length,
        realPosts: live.realPosts.length,
        source: live.source,
        dataGaps: live.dataGaps,
      });
      const planText = await generateGrowthAI(
        withLiveAccountUser(
          `Create a paid reboost plan for this live post:\n${JSON.stringify(post)}\nDaily budget: ${budget || 20}`,
          live
        ),
        withLiveAccountRules(
          'Return markdown with audience, creative variants, and budget split. Use only the provided live post metrics and LIVE_CONNECTED_ACCOUNT_DATA. If metrics are missing, say unknown — do not invent ROAS.'
        )
      );

      const admin = getSupabaseAdmin();
      let providerCampaignId: string | null = null;
      let status = 'drafted';
      let error: string | null = null;

      const { data: conn } = await admin
        .from('social_connections')
        .select('id, ad_account_id, platform')
        .eq('client_id', clientId)
        .eq('org_id', auth.orgId)
        .in('platform', ['meta_ads', 'facebook'])
        .maybeSingle();
      if (conn?.ad_account_id) {
        const { data: secret } = await admin
          .from('social_connection_secrets')
          .select('access_token')
          .eq('connection_id', conn.id)
          .maybeSingle();
        if (secret?.access_token) {
          try {
            const created = await createMetaBoost({
              accessToken: secret.access_token,
              adAccountId: conn.ad_account_id,
              name: `Reboost: ${post.title || 'GrowthOS'}`,
              dailyBudget: Number(budget) || 20,
            });
            providerCampaignId = created.id;
            status = 'created_paused';
          } catch (err: any) {
            error = err.message;
            status = 'plan_only';
          }
        }
      }

      const { data: job, error: jobErr } = await admin
        .from('reboost_jobs')
        .insert({
          org_id: auth.orgId,
          client_id: clientId,
          post_id: post.id,
          post_title: post.title,
          platform: post.platform,
          budget: Number(budget) || 20,
          status,
          plan: { markdown: planText },
          provider_campaign_id: providerCampaignId,
          error,
          created_by: auth.userId,
        })
        .select('*')
        .single();
      if (jobErr) throw new Error(jobErr.message);
      res.json({ success: true, job });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
      try {
        const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
        if (process.env.STRIPE_WEBHOOK_SECRET && !verifyStripeSignature(raw, req.header('stripe-signature') || undefined)) {
          res.status(400).json({ success: false, error: 'Invalid Stripe signature' });
          return;
        }
        const event = JSON.parse(raw.toString('utf8'));
        const admin = getSupabaseAdmin();
        if (event.type === 'checkout.session.completed') {
          const session = event.data?.object;
          if (session?.metadata?.kind === 'invoice' && session.metadata.invoice_id) {
            await admin
              .from('invoices')
              .update({
                status: 'paid',
                paid_at: new Date().toISOString(),
                stripe_payment_intent_id: session.payment_intent || null,
              })
              .eq('id', session.metadata.invoice_id);
          }
          if (session?.metadata?.kind === 'subscription' && session.metadata.org_id) {
            await admin
              .from('organizations')
              .update({
                billing_tier: session.metadata.tier || 'growth',
                billing_status: 'active',
                stripe_customer_id: session.customer || null,
              })
              .eq('id', session.metadata.org_id);
          }
        }
        res.json({ received: true });
      } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
      }
    }
  );
}
