import { getSupabaseAdmin } from '../supabaseAdmin';

const LIVE_BLOCK_MAX = 9_000;
const TASK_BUDGET = 24_000;

export type LiveAccountContext = {
  hasLive: boolean;
  source: string;
  updatedAt: string | null;
  accounts: Array<{
    platform: string;
    accountName: string;
    status: string;
    followers: number;
    reach24h: number;
    engagement24h: number;
    impressions24h: number;
    clicks24h: number;
    spend30d: number;
    conversions30d: number;
    revenue30d: number;
    healthScore: number;
    lastSync: string | null;
    lastError: string | null;
  }>;
  realPosts: Array<{
    id: string;
    title: string;
    platform: string;
    postDate?: string;
    reach: number;
    impressions: number;
    saves: number;
    shares: number;
    likes: number;
    comments: number;
    clicks: number;
  }>;
  dataGaps: string[];
  promptBlock: string;
  publicSummary: {
    hasLive: boolean;
    source: string;
    updatedAt: string | null;
    accountCount: number;
    platforms: string[];
    realPostCount: number;
    dataGaps: string[];
  };
};

const EMPTY: LiveAccountContext = {
  hasLive: false,
  source: 'none',
  updatedAt: null,
  accounts: [],
  realPosts: [],
  dataGaps: ['No social account has been synced for this brand.'],
  promptBlock:
    'LIVE_CONNECTED_ACCOUNT_DATA: none. No social account has been synced for this brand. Do not invent follower counts, reach, spend, posting times, or ROAS. Say those numbers are unknown and that the user should connect the brand and tap Sync on Social accounts.',
  publicSummary: {
    hasLive: false,
    source: 'none',
    updatedAt: null,
    accountCount: 0,
    platforms: [],
    realPostCount: 0,
    dataGaps: ['No social account has been synced for this brand.'],
  },
};

export const LIVE_ACCOUNT_AI_RULES = `You MUST treat LIVE_CONNECTED_ACCOUNT_DATA as the only source of this brand's account facts.
- Cite connected platforms, last-sync totals, and named recent posts when you recommend a tactic.
- Do not invent followers, reach, impressions, spend, clicks, conversions, ROAS, or posting-hour winners.
- If a field is listed under dataGaps or missing, write "unknown".
- Hour-of-day performance is never in this snapshot — posting time must be "unknown" unless the calendar task itself includes a scheduled time.
- Derived scores (growth_score, virality_score) are formulas from last-sync aggregates, not forecasts. Do not treat them as predicted future performance.
- If hasLive is false, say so first, then give process advice only (connect this brand on Social accounts and tap Sync).`;

export function withLiveAccountRules(systemPrompt: string, _ctx?: LiveAccountContext) {
  return `${systemPrompt}

${LIVE_ACCOUNT_AI_RULES}`;
}

/** Live snapshot first so Gemini truncation cannot drop account facts. */
export function withLiveAccountUser(userPrompt: string, ctx: LiveAccountContext) {
  const live = ctx.promptBlock.slice(0, LIVE_BLOCK_MAX);
  const budget = Math.max(1_000, TASK_BUDGET - live.length - 24);
  const task =
    userPrompt.length > budget ? `${userPrompt.slice(0, budget)}\n\n[task truncated]` : userPrompt;
  return `${live}

---
TASK:
${task}`;
}

function isSyntheticRollup(post: any): boolean {
  const title = String(post?.title || '');
  const id = String(post?.id || '');
  return /last 24h/i.test(title) || (post?.source === 'live_sync' && /^(instagram|facebook|tiktok|youtube|linkedin|meta_ads)-/i.test(id));
}

function isRealProviderPost(post: any): boolean {
  if (!post || typeof post !== 'object' || isSyntheticRollup(post)) return false;
  const id = String(post.id || '').trim();
  const title = String(post.title || post.caption || post.hookText || '').trim();
  if (!id || id.length < 5 || !title) return false;
  return true;
}

function normalizePost(post: any, fallbackPlatform: string) {
  return {
    id: String(post.id),
    title: String(post.title || post.caption || post.hookText || 'Untitled').slice(0, 120),
    platform: String(post.platform || fallbackPlatform || ''),
    postDate: post.postDate || post.timestamp || undefined,
    reach: Number(post.reach || 0),
    impressions: Number(post.impressions || 0),
    saves: Number(post.saves || 0),
    shares: Number(post.shares || 0),
    likes: Number(post.likes || 0),
    comments: Number(post.comments || 0),
    clicks: Number(post.clicks || 0),
  };
}

function topAudience(demo: any): Array<{ label: string; value: number }> {
  if (!demo || typeof demo !== 'object') return [];
  const merged: Record<string, number> = {};
  for (const bag of [demo.ageGender, demo.adsAgeGender, demo.gender, demo.age]) {
    if (!bag || typeof bag !== 'object') continue;
    for (const [key, value] of Object.entries(bag)) {
      const n = Number(value || 0);
      if (n > 0) merged[String(key)] = (merged[String(key)] || 0) + n;
    }
  }
  return Object.entries(merged)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label, value]) => ({ label, value }));
}

export function constrainPrediction(parsed: any, ctx: LiveAccountContext) {
  const followers = ctx.accounts.reduce((sum, a) => sum + a.followers, 0);
  const reach24h = ctx.accounts.reduce((sum, a) => sum + a.reach24h, 0);
  const engagement24h = ctx.accounts.reduce((sum, a) => sum + a.engagement24h, 0);
  parsed.baseline = { followers, reach24h, engagement24h, realPostCount: ctx.realPosts.length };
  parsed.dataGaps = ctx.dataGaps;
  parsed.liveDataUsed = ctx.hasLive;
  parsed.liveSource = ctx.source;
  parsed.optimalPostingTime = 'unknown — last sync has no hour-of-day Insights';

  parsed.viralityScore = Number(parsed.viralityScore) || 0;
  parsed.engagementScore = Number(parsed.engagementScore) || 0;
  parsed.confidenceScore = Number(parsed.confidenceScore) || 0;
  if (!Array.isArray(parsed.recommendedTweaks)) parsed.recommendedTweaks = [];

  if (!ctx.hasLive) {
    parsed.estimatedReach = 'unknown — connect this brand and tap Sync on Social accounts';
    parsed.viralityScore = 0;
    parsed.engagementScore = 0;
    parsed.conversionProbability = 'unknown';
    parsed.confidenceScore = 0;
    return parsed;
  }

  const cap = Math.max(followers * 2, reach24h * 14, 1);
  const nums =
    String(parsed.estimatedReach || '')
      .match(/\d[\d,]*/g)
      ?.map((n: string) => Number(n.replace(/,/g, '')))
      .filter((n: number) => Number.isFinite(n) && n > 0) || [];
  if (!nums.length || nums.some((n: number) => n > cap * 1.5)) {
    parsed.estimatedReach =
      reach24h > 0
        ? `unknown as a forecast — last-sync 24h reach is ${reach24h.toLocaleString()} (followers ${followers.toLocaleString()}). Do not treat a larger invented range as measured.`
        : followers > 0
          ? `unknown as a forecast — last-sync followers ${followers.toLocaleString()}, 24h reach 0`
          : 'unknown';
    parsed.confidenceScore = Math.min(Number(parsed.confidenceScore) || 0, 30);
  }

  const saveLeader = [...ctx.realPosts].sort((a, b) => b.saves - a.saves)[0];
  if (saveLeader?.title && parsed.recommendedTweaks.length < 3) {
    parsed.recommendedTweaks = [
      `Repeat the pattern of last-sync post “${saveLeader.title}” (${saveLeader.saves} saves, ${saveLeader.reach} reach)`,
      ...parsed.recommendedTweaks,
    ].slice(0, 5);
  }
  return parsed;
}

export async function loadLiveAccountContext(
  orgId: string | null | undefined,
  clientId: string | null | undefined
): Promise<LiveAccountContext> {
  if (!orgId || !String(clientId || '').trim()) return EMPTY;

  const admin = getSupabaseAdmin();
  const [connRes, insightRes] = await Promise.all([
    admin
      .from('social_connections')
      .select(
        'platform, account_name, status, followers, reach_24h, engagement_24h, impressions_24h, clicks_24h, spend_30d, conversions_30d, revenue_30d, health_score, last_sync, last_error, posts, demographics'
      )
      .eq('org_id', orgId)
      .eq('client_id', clientId),
    admin.from('client_live_insights').select('*').eq('org_id', orgId).eq('client_id', clientId).maybeSingle(),
  ]);
  if (connRes.error) console.warn('[ai] live context connections failed', connRes.error.message);
  if (insightRes.error) console.warn('[ai] live context insights failed', insightRes.error.message);

  const connections = connRes.data || [];
  const insights = insightRes.data;

  const accounts = connections.map((row: any) => ({
    platform: String(row.platform || ''),
    accountName: String(row.account_name || ''),
    status: String(row.status || ''),
    followers: Number(row.followers || 0),
    reach24h: Number(row.reach_24h || 0),
    engagement24h: Number(row.engagement_24h || 0),
    impressions24h: Number(row.impressions_24h || 0),
    clicks24h: Number(row.clicks_24h || 0),
    spend30d: Number(row.spend_30d || 0),
    conversions30d: Number(row.conversions_30d || 0),
    revenue30d: Number(row.revenue_30d || 0),
    healthScore: Number(row.health_score || 0),
    lastSync: row.last_sync || null,
    lastError: row.last_error || null,
  }));

  const fromConnections: any[] = [];
  let droppedSynthetic = 0;
  for (const row of connections) {
    for (const post of Array.isArray(row.posts) ? row.posts : []) {
      if (isSyntheticRollup(post)) {
        droppedSynthetic += 1;
        continue;
      }
      if (isRealProviderPost(post)) fromConnections.push(normalizePost(post, row.platform));
    }
  }
  const fromInsights = (Array.isArray(insights?.posts) ? insights.posts : [])
    .filter((post: any) => {
      if (isSyntheticRollup(post)) {
        droppedSynthetic += 1;
        return false;
      }
      return isRealProviderPost(post);
    })
    .map((post: any) => normalizePost(post, ''));

  const seen = new Set<string>();
  const realPosts = [...fromConnections, ...fromInsights]
    .filter((post) => {
      if (seen.has(post.id)) return false;
      seen.add(post.id);
      return true;
    })
    .sort((a, b) => b.saves + b.reach - (a.saves + a.reach))
    .slice(0, 8);

  const audience = connections.flatMap((row: any) => topAudience(row.demographics)).slice(0, 4);
  const followers = accounts.reduce((s, a) => s + a.followers, 0);
  const reach24h = accounts.reduce((s, a) => s + a.reach24h, 0);
  const engagement24h = accounts.reduce((s, a) => s + a.engagement24h, 0);
  const spend30d = accounts.reduce((s, a) => s + a.spend30d, 0);
  const conversions30d = accounts.reduce((s, a) => s + a.conversions30d, 0);
  const connected = accounts.filter((a) => a.status === 'connected');
  const metricLive = connected.some(
    (a) => a.followers > 0 || a.reach24h > 0 || a.impressions24h > 0 || a.engagement24h > 0 || a.spend30d > 0
  );
  const hasLive = metricLive || realPosts.length > 0;
  const source = hasLive
    ? insights?.source === 'live_sync'
      ? 'live_sync'
      : 'connections'
    : connected.length
      ? 'connected_empty'
      : 'none';

  const dataGaps: string[] = [];
  if (!hasLive) {
    dataGaps.push(
      connected.length
        ? 'Accounts are connected but last sync has no followers, reach, posts, or spend. Tap Sync or check last_error on Social accounts.'
        : 'No social account has been synced for this brand.'
    );
  }
  if (!realPosts.length) dataGaps.push('No individual provider posts (e.g. Instagram media) in last sync.');
  if (!spend30d) dataGaps.push('No ads spend in last sync.');
  if (!conversions30d) dataGaps.push('No conversions/purchases in last sync.');
  dataGaps.push('No hour-of-day posting performance in last sync.');
  if (!audience.length) dataGaps.push('No age/gender audience breakdown in last sync.');

  const topPost = realPosts[0];
  const brief = {
    hasLive,
    source,
    updatedAt: insights?.updated_at || accounts.find((a) => a.lastSync)?.lastSync || null,
    accounts: accounts.map((a) => ({
      platform: a.platform,
      accountName: a.accountName,
      status: a.status,
      followers: a.followers,
      reach24h: a.reach24h,
      engagement24h: a.engagement24h,
      impressions24h: a.impressions24h,
      clicks24h: a.clicks24h,
      spend30d: a.spend30d,
      conversions30d: a.conversions30d,
      revenue30d: a.revenue30d,
      lastSync: a.lastSync,
      lastError: a.lastError,
    })),
    totals: { followers, reach24h, engagement24h, spend30d, conversions30d },
    engagementRate: reach24h ? Number((engagement24h / reach24h).toFixed(4)) : 0,
    recentProviderPosts: realPosts,
    winningPost:
      topPost && (topPost.saves > 0 || topPost.reach > 0)
        ? {
            title: topPost.title,
            platform: topPost.platform,
            reach: topPost.reach,
            saves: topPost.saves,
            likes: topPost.likes,
          }
        : null,
    audienceFromProvider: audience,
    derivedScoresLabel: 'formula from last-sync aggregates — not a forecast',
    derivedScores: insights
      ? {
          growth_score: insights.growth_score,
          virality_score: insights.virality_score,
          engagement_health: insights.engagement_health,
          conversion_score: insights.conversion_score,
          roi_multiplier: insights.roi_multiplier,
        }
      : null,
    dataGaps,
  };

  const promptBlock = `LIVE_CONNECTED_ACCOUNT_DATA (last provider sync only — not invented):\n${JSON.stringify(brief).slice(0, LIVE_BLOCK_MAX)}`;

  console.info('[ai] live snapshot', {
    clientId,
    hasLive,
    source,
    accounts: accounts.length,
    connected: connected.length,
    realPosts: realPosts.length,
    droppedSyntheticPosts: droppedSynthetic,
    followers,
    reach24h,
    spend30d,
    audienceSegments: audience.length,
    dataGaps: dataGaps.length,
    briefChars: promptBlock.length,
  });

  return {
    hasLive,
    source,
    updatedAt: brief.updatedAt,
    accounts,
    realPosts,
    dataGaps,
    promptBlock,
    publicSummary: {
      hasLive,
      source,
      updatedAt: brief.updatedAt,
      accountCount: accounts.length,
      platforms: [...new Set(accounts.map((a) => a.platform).filter(Boolean))],
      realPostCount: realPosts.length,
      dataGaps,
    },
  };
}

export function slimCalendarForAi(calendarData: unknown) {
  const items = Array.isArray(calendarData) ? calendarData : [];
  return items.slice(0, 40).map((item: any) => ({
    date: item.date || item.scheduledAt || '',
    time: item.time || '',
    platform: item.platform || '',
    contentType: item.contentType || item.postType || '',
    topic: String(item.topic || item.title || '').slice(0, 160),
    hookText: String(item.hookText || '').slice(0, 180),
    status: item.status || '',
    aiScore: item.aiScore ?? null,
  }));
}
