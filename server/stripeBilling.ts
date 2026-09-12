import { getAppUrl } from './appUrl';

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

async function stripeRequest(path: string, params: Record<string, string>) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set.');
  const body = new URLSearchParams(params);
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Stripe request failed (${res.status})`);
  }
  return data;
}

export async function createInvoiceCheckout(input: {
  invoiceId: string;
  amount: number;
  currency: string;
  description: string;
  customerEmail?: string;
}) {
  const appUrl = getAppUrl().replace(/\/$/, '');
  return stripeRequest('/checkout/sessions', {
    mode: 'payment',
    'success_url': `${appUrl}/?view=invoices&paid=${input.invoiceId}`,
    'cancel_url': `${appUrl}/?view=invoices&canceled=${input.invoiceId}`,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': input.currency.toLowerCase(),
    'line_items[0][price_data][unit_amount]': String(Math.round(input.amount * 100)),
    'line_items[0][price_data][product_data][name]': input.description || 'GrowthOS invoice',
    'metadata[invoice_id]': input.invoiceId,
    'metadata[kind]': 'invoice',
    ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
  });
}

const TIER_PRICES: Record<string, { name: string; amount: number }> = {
  starter: { name: 'GrowthOS Starter', amount: 0 },
  growth: { name: 'GrowthOS Growth', amount: 7900 },
  agency: { name: 'GrowthOS Agency', amount: 19900 },
};

export function listBillingTiers() {
  return Object.entries(TIER_PRICES).map(([id, t]) => ({
    id,
    name: t.name,
    amountUsd: t.amount / 100,
  }));
}

export async function createSubscriptionCheckout(input: {
  orgId: string;
  tier: string;
  customerEmail?: string;
}) {
  const tier = TIER_PRICES[input.tier];
  if (!tier) throw new Error('Unknown billing tier.');
  if (tier.amount === 0) {
    return { id: 'free', url: null, free: true };
  }
  const appUrl = getAppUrl().replace(/\/$/, '');
  return stripeRequest('/checkout/sessions', {
    mode: 'subscription',
    'success_url': `${appUrl}/?view=settings&billing=success`,
    'cancel_url': `${appUrl}/?view=settings&billing=canceled`,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(tier.amount),
    'line_items[0][price_data][recurring][interval]': 'month',
    'line_items[0][price_data][product_data][name]': tier.name,
    'metadata[org_id]': input.orgId,
    'metadata[kind]': 'subscription',
    'metadata[tier]': input.tier,
    ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
  });
}

export function verifyStripeSignature(rawBody: Buffer, signature: string | undefined) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  // Stripe signed payload: t=timestamp,v1=hmac
  const parts = Object.fromEntries(
    signature.split(',').map((p) => {
      const [k, ...rest] = p.split('=');
      return [k, rest.join('=')];
    })
  );
  const crypto = require('crypto') as typeof import('crypto');
  const signed = `${parts.t}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(signed).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1 || ''));
  } catch {
    return false;
  }
}
