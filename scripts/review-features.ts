/**
 * Honest regression checks for the live-integrations work.
 * Run: npx tsx scripts/review-features.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { createApp } from '../server/app';
import { buildAuthorizeUrl, pickMetaAsset, providerConfig, resolveOAuthRedirectUri } from '../server/social/providers';
import {
  composeCaption,
  grantedScopesFromPermissions,
  hasMetaPublishScopes,
  isPublicMediaUrl,
  resolvePublishKind,
  scheduledAtIso,
} from '../shared/calendarPublish';
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
    'non-numeric Meta App ID is rejected before Facebook login',
    (() => {
      try {
        buildAuthorizeUrl('instagram', 'bad-id', { meta: { clientId: '@auraskin_official', secret: 'abc' } });
        return false;
      } catch (err: any) {
        return String(err.message).includes('numeric');
      }
    })()
  );
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
  assert(
    'authorize URL without Meta credentials throws',
    threw
  );

  const classicWithoutConfig = (() => {
    try {
      buildAuthorizeUrl(
        'instagram',
        'state-2',
        { meta: { clientId: '123456789012345', secret: 'abc' } },
        'https://app.growth.example/auth/callback'
      );
      return 'built';
    } catch (err: any) {
      return String(err.message);
    }
  })();
  assert(
    'Meta authorize without configuration ID is rejected',
    /Configuration ID/i.test(classicWithoutConfig)
  );

  const url = buildAuthorizeUrl(
    'instagram',
    'state-2',
    {
      meta: {
        clientId: '123456789012345',
        secret: 'abc',
        extra: { configId: '987654321098765' },
      },
    },
    'https://app.growth.example/auth/callback'
  );
  assert(
    'authorize URL includes Meta client id, config_id, and the same callback used for token exchange',
    url.includes('client_id=123456789012345') &&
      url.includes('config_id=987654321098765') &&
      url.includes(encodeURIComponent('https://app.growth.example/auth/callback'))
  );
  assert(
    'Login for Business authorize URL does not send scope or auth_type=rerequest',
    !/[?&]scope=/.test(url) && !url.includes('auth_type=rerequest') && url.includes('override_default_response_type=true')
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
  assert(
    'calendar publish migration exists',
    fs.existsSync(path.join(process.cwd(), 'supabase/migrations/20260912190000_calendar_publish.sql'))
  );
  assert(
    'Vercel routes calendar publish to Express',
    read('vercel.json').includes('/api/calendar/:path*') && read('vercel.json').includes('/api/calendar/due')
  );
  assert(
    'Vercel API function is a bundled JavaScript file',
    read('vercel.json').includes('api/index.js') && read('package.json').includes('build:api')
  );
  assert(
    'Instagram OAuth requests content publish',
    providerConfig('instagram', { meta: { clientId: '123', secret: 'abc' } }).scopes.includes(
      'instagram_content_publish'
    )
  );
  assert(
    'Facebook OAuth requests Page publishing',
    providerConfig('facebook', { meta: { clientId: '123', secret: 'abc' } }).scopes.includes('pages_manage_posts')
  );
  const publishAuthUrl = buildAuthorizeUrl(
    'instagram',
    'state-publish',
    {
      meta: {
        clientId: '123456789012345',
        secret: 'abc',
        extra: { configId: '987654321098765' },
      },
    },
    'https://app.growth.example/auth/callback'
  );
  assert(
    'Meta publishing login uses configuration ID instead of rerequest scope',
    publishAuthUrl.includes('config_id=987654321098765') && !publishAuthUrl.includes('auth_type=rerequest')
  );
  assert(
    'meta config id migration exists',
    fs.existsSync(path.join(process.cwd(), 'supabase/migrations/20260918120000_meta_config_id.sql'))
  );
  assert(
    'insights-only tokens cannot publish',
    hasMetaPublishScopes('instagram', 'instagram_basic,instagram_manage_insights') === false
  );
  assert(
    'publish scopes unlock Instagram posting',
    hasMetaPublishScopes('instagram', 'instagram_content_publish,pages_manage_posts') === true
  );
  assert(
    'granted scopes ignore declined Meta permissions',
    grantedScopesFromPermissions({
      data: [
        { permission: 'instagram_basic', status: 'granted' },
        { permission: 'instagram_content_publish', status: 'declined' },
      ],
    }) === 'instagram_basic'
  );
  assert(
    'OAuth stores Graph granted permissions, not the requested list',
    read('server/social/providers.ts').includes('fetchGrantedMetaScopes') &&
      read('server/social/providers.ts').includes('/me/permissions')
  );
  assert(
    'publish claim is a single Postgres update',
    fs.existsSync(path.join(process.cwd(), 'supabase/migrations/20260912200000_calendar_publish_claim.sql')) &&
      read('server/social/publishRunner.ts').includes("rpc('claim_calendar_publish'")
  );
  assert(
    'Vercel cron is daily so Hobby deploys are valid',
    read('vercel.json').includes('"0 8 * * *"')
  );
  assert(
    'GET due requires an org unless cron-authenticated',
    read('server/social/publishRoutes.ts').includes("Complete workspace onboarding first.") &&
      read('server/social/publishRoutes.ts').includes('canManageCalendar')
  );
  assert(
    'new calendar posts default to a photo format',
    read('src/components/ContentCalendarView.tsx').includes("useState<any>('Carousel')")
  );
  assert('base64 media is rejected for Meta', isPublicMediaUrl('data:image/png;base64,abc').ok === false);
  assert(
    'https media is accepted',
    isPublicMediaUrl('https://example.com/calendar-media/x.jpg').ok === true
  );
  assert(
    'Instagram reel without video is refused',
    Boolean(resolvePublishKind({ platform: 'instagram', contentType: 'Reel' }).error)
  );
  assert(
    'Facebook can publish caption-only',
    resolvePublishKind({ platform: 'facebook', captionText: 'Hello from GrowthOS' }).kind === 'fb_text'
  );
  assert(
    'caption prefers the live caption field',
    composeCaption({ topic: 'Topic', hookText: 'Hook', captionText: 'Live caption', cta: 'Shop' }) ===
      'Live caption\n\nShop'
  );
  const lagos = scheduledAtIso('2026-09-12', '19:30', 'Africa/Lagos');
  assert('scheduled_at is stored as an absolute instant', Boolean(lagos && new Date(lagos).toISOString() === lagos));

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

    const due = await fetch(`${http.url}/api/calendar/due`, { method: 'POST' });
    assert('POST /api/calendar/due without JWT or cron secret is 401', due.status === 401);
    const publishNow = await fetch(`${http.url}/api/calendar/post-1/publish`, { method: 'POST' });
    assert('POST /api/calendar/:id/publish without JWT is 401', publishNow.status === 401);

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
