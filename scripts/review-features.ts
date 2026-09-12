/**
 * Honest regression checks for the live-integrations work.
 * Run: npx tsx scripts/review-features.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { createApp } from '../server/app';
import { buildAuthorizeUrl, pickMetaAsset, providerConfig, resolveOAuthRedirectUri } from '../server/social/providers';
import { campaignMetricsFromInsights } from '../server/insightsEngine';
import { PRODUCTION_APP_URL, getAppUrl } from '../server/appUrl';

type Check = { name: string; ok: boolean; detail?: string };

const checks: Check[] = [];

function assert(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ''}`);
}

function read(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}

async function listen(app: ReturnType<typeof createApp>) {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No listen port');
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

async function main() {
  const sql = read('supabase/migrations/20260912140000_live_integrations.sql');
  assert(
    'social_connections.client_id is text (matches clients.id)',
    /client_id text NOT NULL REFERENCES public.clients/.test(sql) &&
      !/client_id uuid NOT NULL REFERENCES public.clients/.test(sql)
  );
  assert(
    'client_live_insights.client_id is text',
    /client_id text PRIMARY KEY REFERENCES public.clients/.test(sql)
  );
  assert(
    'invoices.client_id is text',
    /client_id text NOT NULL REFERENCES public.clients/.test(sql) &&
      /invoice_number text NOT NULL/.test(sql)
  );
  assert(
    'repair migration exists for leftover uuid client_id',
    fs.existsSync(path.join(process.cwd(), 'supabase/migrations/20260912160000_fix_client_id_text.sql'))
  );
  assert(
    'org provider apps migration adds google/tiktok/linkedin columns',
    fs.existsSync(path.join(process.cwd(), 'supabase/migrations/20260912170000_org_provider_apps.sql'))
  );
  const youtubeBare = providerConfig('youtube');
  const youtubeOverride = providerConfig('youtube', { google: { clientId: 'g-id', secret: 'g-secret' } });
  assert('youtube without org/env is not configured', youtubeBare.configured === false);
  assert('youtube with org google override is configured', youtubeOverride.configured === true);

  const instagram = providerConfig('instagram');
  assert('instagram without env/override is not configured', instagram.configured === false);
  const instagramOverride = providerConfig('instagram', { meta: { clientId: '123', secret: 'abc' } });
  assert('instagram with org override is configured', instagramOverride.configured === true);
  assert(
    'authorize URL defaults to getAppUrl callback',
    instagramOverride.redirectUri === `${getAppUrl()}/auth/callback`
  );
  assert(
    'redirect uses browser origin when it matches the request',
    resolveOAuthRedirectUri('https://app.growth.example/auth/callback', 'https://app.growth.example') ===
      'https://app.growth.example/auth/callback'
  );
  assert(
    'redirect rejects a mismatched foreign callback',
    resolveOAuthRedirectUri('https://evil.example/auth/callback', 'https://app.growth.example') ===
      'https://app.growth.example/auth/callback'
  );
  assert(
    'oauth_states.redirect_uri migration exists',
    fs.existsSync(path.join(process.cwd(), 'supabase/migrations/20260912180000_oauth_redirect_uri.sql'))
  );
  assert(
    'production app URL is the live Vercel host',
    PRODUCTION_APP_URL === 'https://growth-ai-alpha-puce.vercel.app'
  );
  assert(
    'Vercel rewrite keeps /auth/callback on the Express auth path',
    read('vercel.json').includes('"/api/auth/:path*"')
  );
  assert(
    'production origin is an allowed OAuth callback',
    resolveOAuthRedirectUri(`${PRODUCTION_APP_URL}/auth/callback`, null) === `${PRODUCTION_APP_URL}/auth/callback`
  );

  let threw = false;
  try {
    buildAuthorizeUrl('instagram', 'state-1');
  } catch {
    threw = true;
  }
  assert('authorize URL without Meta credentials throws', threw);

  const url = buildAuthorizeUrl(
    'instagram',
    'state-2',
    { meta: { clientId: '123', secret: 'abc' } },
    'https://app.growth.example/auth/callback'
  );
  assert(
    'authorize URL includes Meta client id and the same callback used for token exchange',
    url.includes('client_id=123') && url.includes(encodeURIComponent('https://app.growth.example/auth/callback'))
  );

  const empty = campaignMetricsFromInsights(null, 5000);
  assert(
    'empty insights do not invent campaign numbers',
    empty.metrics.impressions === 0 && empty.metrics.revenueGenerated === 0 && empty.metrics.leads === 0
  );

  const live = campaignMetricsFromInsights(
    { source: 'live_sync', demographics: { impressions: 100, engagement: 10, clicks: 4, conversions: 1, revenue: 80, spend: 20 } },
    0
  );
  assert('live insights map clicks and conversions', live.metrics.clicks === 4 && live.metrics.conversions === 1);
  assert('ROI uses reported spend/revenue', live.metrics.roas === 4);

  const liveApi = read('src/lib/liveApi.ts');
  assert(
    'connection mapper keeps real connection id',
    liveApi.includes('connectionId: row.id') && liveApi.includes('followers: Number(row.followers || 0)')
  );

  const routes = read('server/social/routes.ts');
  assert('OAuth callback HTML is escaped', routes.includes('function escapeHtml'));
  assert('OAuth postMessage uses opener origin', routes.includes('row.redirect_origin'));
  assert('OAuth state stores redirect_uri', routes.includes('redirect_uri: redirectUri'));
  assert('WhatsApp connect verifies against Meta Graph', read('server/meta/staffRoutes.ts').includes('verifyWhatsAppNumber'));
  const providersSrc = read('server/social/providers.ts');
  assert(
    'Meta Insights requests one demographic breakdown at a time',
    providersSrc.includes('breakdown=${breakdown}') && !providersSrc.includes('breakdown=age,gender')
  );
  assert(
    'Instagram demographics always send a documented timeframe',
    providersSrc.includes('timeframe=this_month') &&
      providersSrc.includes('timeframe=this_week') &&
      !providersSrc.includes('metric_type=total_value&breakdown=')
  );
  assert(
    'deprecated Page fan Insights metrics are not requested',
    !providersSrc.includes('page_fans_gender_age') &&
      !providersSrc.includes('page_fans_country') &&
      !providersSrc.includes('audience_gender_age')
  );
  assert(
    'agency Meta login binds the named brand account, not the first Page',
    pickMetaAsset(
      [
        { kind: 'instagram', id: 'ig-a', name: '@acme', pageName: 'Acme' },
        { kind: 'instagram', id: 'ig-b', name: '@other', pageName: 'Other' },
      ],
      'instagram',
      { clientName: 'Acme' }
    )?.id === 'ig-a'
  );

  const app = createApp();
  const http = await listen(app);
  try {
    const healthRes = await fetch(`${http.url}/api/health`);
    const health = await healthRes.json();
    assert('GET /api/health returns ok', healthRes.status === 200 && health.status === 'ok');
    assert('health reports supabaseConfigured as boolean', typeof health.supabaseConfigured === 'boolean');

    const orgMeta = await fetch(`${http.url}/api/org/meta`);
    const orgBody = await orgMeta.json();
    assert('GET /api/org/meta without JWT is 401', orgMeta.status === 401 && orgBody.success === false);
    const orgProviders = await fetch(`${http.url}/api/org/providers`);
    assert('GET /api/org/providers without JWT is 401', orgProviders.status === 401);

    const oauthUrl = await fetch(`${http.url}/api/auth/instagram/url?clientId=client-1`);
    assert('GET /api/auth/instagram/url without JWT is 401', oauthUrl.status === 401);

    const invoices = await fetch(`${http.url}/api/invoices`);
    assert('GET /api/invoices without JWT is 401', invoices.status === 401);

    const insights = await fetch(`${http.url}/api/insights/client-1`);
    assert('GET /api/insights/:id without JWT is 401', insights.status === 401);

    const webhook = await fetch(`${http.url}/api/meta/webhook`);
    assert('GET /api/meta/webhook without verify token is 403', webhook.status === 403);

    const callback = await fetch(`${http.url}/auth/callback?error=<script>alert(1)</script>`);
    const html = await callback.text();
    assert('OAuth callback rejects missing code', callback.status === 400);
    assert('OAuth callback does not reflect raw HTML', !html.includes('<script>alert(1)</script>'));
  } finally {
    await http.close();
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
