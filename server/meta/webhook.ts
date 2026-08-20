import crypto from 'crypto';
import type { Express, Request, Response } from 'express';
import express from 'express';
import { ingestWhatsAppWebhookPayload } from './ingest';

type GenerateFn = (prompt: string, system?: string) => Promise<string>;

function requireSignature(): boolean {
  if (process.env.META_REQUIRE_SIGNATURE === 'true') return true;
  if (process.env.META_REQUIRE_SIGNATURE === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

export function verifyMetaSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret) {
    if (requireSignature()) return false;
    return true;
  }
  if (!signatureHeader?.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = signatureHeader.slice('sha256='.length);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

export function registerMetaWebhookRoutes(app: Express, generateGrowthAI?: GenerateFn) {
  // Verification challenge
  app.get('/api/meta/webhook', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

    if (mode === 'subscribe' && token && verifyToken && token === verifyToken) {
      res.status(200).send(String(challenge || ''));
      return;
    }
    res.status(403).send('Forbidden');
  });

  // Inbound events — raw body needed for signature verification
  app.post(
    '/api/meta/webhook',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
      try {
        const raw = Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));

        const signature = req.header('x-hub-signature-256') || undefined;
        if (!verifyMetaSignature(raw, signature)) {
          res.status(401).json({ success: false, error: 'Invalid signature' });
          return;
        }

        const payload = JSON.parse(raw.toString('utf8'));
        const result = await ingestWhatsAppWebhookPayload(payload, generateGrowthAI);
        res.status(200).json({ success: true, ...result });
      } catch (err: any) {
        console.error('WhatsApp webhook error:', err);
        // Always 200 to Meta after accept to avoid endless retries on app bugs —
        // but validation failures above return 4xx. Processing errors: 500 so Meta retries.
        res.status(500).json({ success: false, error: err.message || 'Webhook processing failed' });
      }
    }
  );
}
