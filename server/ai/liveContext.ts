import { getSupabaseAdmin } from '../supabaseAdmin';

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
  promptBlock: string;
  publicSummary: {
    hasLive: boolean;
    source: string;
    updatedAt: string | null;
    accountCount: number;
    platforms: string[];
  };
};

const EMPTY: LiveAccountContext = {
  hasLive: false,
  source: 'none',
  updatedAt: null,
  accounts: [],
  promptBlock:
    'LIVE_CONNECTED_ACCOUNT_DATA: none. No social account has been synced for this brand. Do not invent follower counts, reach, spend, or ROAS. Say the numbers are unknown and that the user should connect the brand and tap Sync on Social accounts.',
  publicSummary: { hasLive: false, source: 'none', updatedAt: null, accountCount: 0, platforms: [] },
};

export const LIVE_ACCOUNT_AI_RULES = `You MUST use LIVE_CONNECTED_ACCOUNT_DATA in the user message as the only source of this brand's account facts.
- Do not invent followers, reach, impressions, spend, clicks, conversions, or ROAS.
- If a metric is missing, write "unknown".
- Ground recommendations in the connected platforms and last-sync numbers.
- If hasLive is false, say so first, then give process advice only (connect this brand on Social accounts and tap Sync).`;

export function withLiveAccountRules(systemPrompt: string, _ctx?: LiveAccountContext) {
  return `${systemPrompt}

${LIVE_ACCOUNT_AI_RULES}`;
}

export function withLiveAccountUser(userPrompt: string, ctx: LiveAccountContext) {
  return `${userPrompt}

${ctx.promptBlock}`;
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
        'platform, account_name, status, followers, reach_24h, engagement_24h, impressions_24h, clicks_24h, spend_30d, conversions_30d, revenue_30d, health_score, last_sync, last_error'
      )
      .eq('org_id', orgId)
      .eq('client_id', clientId),
    admin.from('client_live_insights').select('*').eq('org_id', orgId).eq('client_id', clientId).maybeSingle(),
  ]);
  if (connRes.error) console.warn('[ai] live context connections failed', connRes.error.message);
  if (insightRes.error) console.warn('[ai] live context insights failed', insightRes.error.message);
  const connections = connRes.data;
  const insights = insightRes.data;

  const accounts = (connections || []).map((row: any) => ({
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

  const liveInsights = insights?.source === 'live_sync' ? insights : null;
  const hasLive = Boolean(liveInsights) || accounts.some((a) => a.status === 'connected' && (a.followers > 0 || a.reach24h > 0 || a.lastSync));

  const posts = Array.isArray(liveInsights?.posts)
    ? liveInsights.posts.slice(0, 8).map((post: any) => ({
        id: post.id,
        title: post.title,
        platform: post.platform,
        reach: post.reach,
        impressions: post.impressions,
        saves: post.saves,
        shares: post.shares,
        likes: post.likes,
        clicks: post.clicks,
        conversions: post.conversions,
        viralityScore: post.viralityScore,
        status: post.status,
        hookText: post.hookText,
      }))
    : [];

  const personas = Array.isArray(liveInsights?.personas)
    ? liveInsights.personas.slice(0, 3).map((p: any) => ({
        name: p.name,
        percentage: p.percentage,
        ageRange: p.ageRange,
        source: p.source,
      }))
    : [];

  const payload = {
    hasLive,
    source: liveInsights?.source || (accounts.length ? 'connections_only' : 'none'),
    updatedAt: liveInsights?.updated_at || accounts.find((a) => a.lastSync)?.lastSync || null,
    accounts,
    scores: liveInsights
      ? {
          growth_score: liveInsights.growth_score,
          virality_score: liveInsights.virality_score,
          engagement_health: liveInsights.engagement_health,
          conversion_score: liveInsights.conversion_score,
          roi_multiplier: liveInsights.roi_multiplier,
        }
      : null,
    totals: liveInsights?.demographics || null,
    trends: Array.isArray(liveInsights?.trends) ? liveInsights.trends.slice(-3) : [],
    posts,
    personas,
  };

  const promptBlock = `LIVE_CONNECTED_ACCOUNT_DATA (JSON, last provider sync — not invented):\n${JSON.stringify(payload).slice(0, 12000)}`;

  return {
    hasLive,
    source: payload.source,
    updatedAt: payload.updatedAt,
    accounts,
    promptBlock,
    publicSummary: {
      hasLive,
      source: payload.source,
      updatedAt: payload.updatedAt,
      accountCount: accounts.length,
      platforms: [...new Set(accounts.map((a) => a.platform).filter(Boolean))],
    },
  };
}
