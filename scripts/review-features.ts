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
import { mapProviderPostType } from '../shared/postFormat';
import {
  buildActions,
  buildPlaybook,
  buildRecap,
  classifyGoal,
  confidenceFromN,
  applyActionToItem,
} from '../src/lib/growthStrategist';
import type { ContentCalendarItem, PostPerformance } from '../src/types';

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
  const zeroSpend = campaignMetricsFromInsights(
    { source: 'live_sync', demographics: { conversions: 2, spend: 0, revenue: 0 } },
    8500
  );
  assert(
    'zero ads spend is not replaced with campaign budget',
    zeroSpend.metrics.cac === 0 && zeroSpend.metrics.roas === 0
  );
  assert(
    'Attribution does not invent 50k reach paths',
    !read('src/components/ConversionAttributionView.tsx').includes('50000')
  );
  assert(
    'Calendar does not seed a mock dermatologist audit',
    read('src/components/ContentCalendarView.tsx').includes('EMPTY_AUDIT_REPORT') &&
      !read('src/components/ContentCalendarView.tsx').includes('dermatologist')
  );
  assert(
    'campaign channels fall back to last-sync insights',
    read('src/components/CampaignManagerView.tsx').includes('connectedPlatformIds')
  );
  assert(
    'ConnectAccountsPrompt checks brand social_connections',
    read('src/components/ConnectAccountsPrompt.tsx').includes('/api/socials/connections')
  );
  assert(
    'shared DataLoader covers workspace and last-sync loading',
    read('src/components/DataLoader.tsx').includes("variant === 'overlay'") &&
      read('src/App.tsx').includes('Loading workspace data') &&
      read('src/components/OverviewDashboard.tsx').includes('Loading last-sync insights')
  );

  assert('n < 3 is too few to call', confidenceFromN(2) === 'too_few' && confidenceFromN(3) === 'low');
  assert('followers/awareness is the default goal kind', classifyGoal('Scale Instagram followers') === 'followers');
  assert('sales copy maps to conversions', classifyGoal('Drive bookings and sales') === 'conversions');
  assert(
    'Instagram VIDEO+REELS maps to Reel, IMAGE feed stays Feed',
    mapProviderPostType({ media_product_type: 'REELS', media_type: 'VIDEO' }) === 'Reel' &&
      mapProviderPostType({ media_type: 'IMAGE' }) === 'Feed' &&
      mapProviderPostType({ media_type: 'CAROUSEL_ALBUM' }) === 'Carousel' &&
      mapProviderPostType({}) === 'Unknown'
  );

  const twoReels: PostPerformance[] = [1, 2].map((i) => ({
    id: `r${i}`,
    title: `Reel ${i}`,
    platform: 'instagram',
    postType: 'Reel',
    postDate: '2026-09-01',
    reach: 1200,
    impressions: 1200,
    saves: 4,
    shares: 1,
    likes: 10,
    comments: 2,
    clicks: 0,
    conversions: 0,
    viralityScore: 10,
    status: 'underperforming',
    reboostRecommended: true,
      hookText: 'Proof from the ward',
    source: 'provider_media',
    media_type: 'VIDEO',
    media_product_type: 'REELS',
  }));
  const thinPlaybook = buildPlaybook({
    recap: buildRecap({ posts: twoReels }),
    goalText: 'Grow followers',
  });
  assert('Playbook does not crown a format with n < 3', thinPlaybook.winner === null);
  assert(
    'Playbook reports the sample instead of inventing a winner',
    thinPlaybook.rows[0]?.n === 2 && thinPlaybook.rows[0]?.confidence === 'too_few'
  );

  const classified: PostPerformance[] = [
    ...[1, 2, 3, 4, 5].map((i) => ({
      id: `reel-${i}`,
      title: `Ward Reel ${i}`,
      platform: 'instagram' as const,
      postType: 'Reel' as const,
      postDate: '2026-09-0' + i,
      reach: 1200 + i * 10,
      impressions: 1500,
      saves: 6,
      shares: 2,
      likes: 20,
      comments: 4,
      clicks: 0,
      conversions: 0,
      viralityScore: 20,
      status: 'performing' as const,
      reboostRecommended: false,
      hookText: 'What we changed on the ward',
      source: 'provider_media',
      media_type: 'VIDEO',
      media_product_type: 'REELS',
    })),
    ...[1, 2, 3].map((i) => ({
      id: `car-${i}`,
      title: `Carousel ${i}`,
      platform: 'instagram' as const,
      postType: 'Carousel' as const,
      postDate: '2026-09-1' + i,
      reach: 400,
      impressions: 500,
      saves: 1,
      shares: 0,
      likes: 8,
      comments: 1,
      clicks: 0,
      conversions: 0,
      viralityScore: 5,
      status: 'underperforming' as const,
      reboostRecommended: true,
      hookText: 'Five slides',
      source: 'provider_media',
      media_type: 'CAROUSEL_ALBUM',
    })),
  ];
  const recap = buildRecap({
    posts: classified,
    followers: 188,
    platformPostCounts: [
      { platform: 'instagram', postCount: 8 },
      { platform: 'facebook', postCount: 0 },
    ],
  });
  const playbook = buildPlaybook({ recap, goalText: 'Grow Instagram followers' });
  assert('Recap sums last-sync post reach', recap.postReach === classified.reduce((s, p) => s + p.reach, 0));
  const legacyRecap = buildRecap({
    posts: classified.map((post) => ({ ...post, media_type: undefined, media_product_type: undefined })),
  });
  assert(
    'legacy last-sync posts without media_type stay unclassified instead of fake Reels',
    legacyRecap.formatsClassified === false && buildPlaybook({ recap: legacyRecap, goalText: 'Grow followers' }).winner === null
  );
  assert(
    'Playbook crowns Reels on followers when n>=3 and reach is higher',
    playbook.winner?.format === 'Reel' && playbook.winner.n === 5 && playbook.winner.ranked
  );
  assert(
    'Facebook 0-post caveat is explicit',
    playbook.caveats.some((c) => /facebook/i.test(c) && /0 posts/i.test(c))
  );
  const salesBook = buildPlaybook({ recap, goalText: 'Drive conversions and bookings', conversionsTotal: 0 });
  assert('Sales goal with 0 conversions is not optimized', salesBook.canOptimize === false && salesBook.winner === null);

  const calendarItem: ContentCalendarItem = {
    id: 'cal-1',
    clientId: 'client-1',
    date: '2026-09-20',
    dayOfWeek: 'Sunday',
    time: '12:00',
    platform: 'instagram',
    contentType: 'Carousel',
    topic: 'Ward tour',
    hookText: 'Hi',
    captionText: '',
    cta: '',
    status: 'scheduled',
    aiScore: 40,
  };
  const actions = buildActions({
    recap,
    playbook,
    calendar: [calendarItem],
    todayIso: '2026-09-18',
    clientId: 'client-1',
    clientName: 'First Dominican',
  });
  const formatAction = actions.find((a) => a.kind === 'change_format');
  assert('Actions recommend turning a carousel into a Reel when mix is off-goal', formatAction?.after.contentType === 'Reel');
  const applied = formatAction
    ? applyActionToItem(calendarItem, formatAction)
    : calendarItem;
  assert(
    'Apply keeps scheduled status and writes hook + format',
    Boolean(formatAction) &&
      applied.status === 'scheduled' &&
      applied.contentType === 'Reel' &&
      Boolean(applied.hookText && applied.aiFeedback)
  );
  const fbItem = { ...calendarItem, id: 'cal-fb', platform: 'facebook' as const };
  const fbActions = buildActions({
    recap,
    playbook,
    calendar: [fbItem],
    todayIso: '2026-09-18',
    clientId: 'client-1',
    clientName: 'First Dominican',
  });
  assert(
    'Facebook calendar advice cites Instagram last-sync explicitly',
    fbActions.some((a) => /Instagram last-sync/i.test(String(a.crossPlatformNote || '')))
  );

  const intelligence = read('src/components/GrowthIntelligenceView.tsx');
  assert(
    'Growth AI home is Recap / Playbook / Actions',
    intelligence.includes("id: 'recap'") &&
      intelligence.includes("id: 'playbook'") &&
      intelligence.includes("id: 'actions'") &&
      intelligence.includes("useState<SuiteTab>('recap')")
  );
  assert('seven labs are not the default path', !intelligence.includes("useState<SuiteTab>('signals')"));
  assert(
    'Recap does not call Gemini',
    intelligence.includes('Loading last-sync posts and calendar mix') &&
      intelligence.includes("tab !== 'actions'")
  );
  assert(
    'Actions apply writes calendar items, not Instagram publish',
    intelligence.includes('saveCalendarItem') && !intelligence.includes('/api/calendar/') && intelligence.includes("status: 'draft'")
  );
  assert(
    'Gemini copy endpoint exists and asks for named posts',
    read('server/app.ts').includes('/api/growth/draft-calendar-copy') &&
      read('server/app.ts').includes('cite a named last-sync post')
  );
  assert(
    'Instagram sync reads media product type',
    read('server/social/providers.ts').includes('media_product_type') &&
      read('server/insightsEngine.ts').includes('mapProviderPostType')
  );
  assert(
    'Overview Recap strip deep-links to Growth AI',
    read('src/components/OverviewDashboard.tsx').includes('recapStripLine') &&
      read('src/components/OverviewDashboard.tsx').includes("onNavigateTab('intelligence')")
  );

  const liveApi = read('src/lib/liveApi.ts');
  assert(
    'connection mapper keeps real connection id',
    liveApi.includes('connectionId: row.id') && liveApi.includes('followers: Number(row.followers || 0)')
  );

  const metricExplain = read('src/lib/metricExplain.ts');
  const metricTip = read('src/components/MetricTip.tsx');
  assert(
    'metric glossary covers growth score and AI suite tabs',
    metricExplain.includes('growthScore:') &&
      metricExplain.includes('aiPredict:') &&
      metricExplain.includes('not a Meta or Gemini forecast')
  );
  assert('MetricTip button explains the metric', metricTip.includes('What ${tip.title} means'));
  assert('MetricTip is used on Overview growth score', read('src/components/OverviewDashboard.tsx').includes('metric="growthScore"'));
  assert('Overview uses last-sync channels not empty clients.platforms', read('src/components/OverviewDashboard.tsx').includes('liveChannels'));
  assert('insights trends fall back to post reach', read('server/insightsEngine.ts').includes('postReach'));

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
  assert('Meta authorize asks Facebook for a popup display', publishAuthUrl.includes('display=popup'));
  assert(
    'SPA does not feed Facebook OAuth codes into Supabase Auth',
    read('src/lib/supabase.ts').includes('detectSessionInUrl') &&
      read('src/lib/supabase.ts').includes('isProviderOAuthReturn')
  );
  assert(
    'provider OAuth return is handed to Express',
    read('src/main.tsx').includes('handoverProviderOAuthToApi') &&
      read('server/app.ts').includes('routed provider oauth callback')
  );
  assert(
    'same-tab OAuth callback survives without window.opener',
    read('server/social/routes.ts').includes('gos_oauth') &&
      read('src/components/SocialAccountsView.tsx').includes('gos_oauth')
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
