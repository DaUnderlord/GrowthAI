import { getSupabaseAdmin } from './supabaseAdmin';

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export async function rebuildClientInsights(clientId: string, orgId: string) {
  const admin = getSupabaseAdmin();
  const { data: connections } = await admin
    .from('social_connections')
    .select('*')
    .eq('client_id', clientId)
    .eq('org_id', orgId)
    .eq('status', 'connected');

  const rows = connections || [];
  const followers = rows.reduce((s, r) => s + Number(r.followers || 0), 0);
  const impressions = rows.reduce((s, r) => s + Number(r.impressions_24h || 0), 0);
  const reach = rows.reduce((s, r) => s + Number(r.reach_24h || 0), 0);
  const engagement = rows.reduce((s, r) => s + Number(r.engagement_24h || 0), 0);
  const clicks = rows.reduce((s, r) => s + Number(r.clicks_24h || 0), 0);
  const spend = rows.reduce((s, r) => s + Number(r.spend_30d || 0), 0);
  const conversions = rows.reduce((s, r) => s + Number(r.conversions_30d || 0), 0);
  const revenue = rows.reduce((s, r) => s + Number(r.revenue_30d || 0), 0);

  const engagementRate = reach ? engagement / reach : followers ? engagement / followers : 0;
  const growthScore = rows.length
    ? clamp(
        (reach ? 20 : 0) +
          engagementRate * 120 +
          (conversions ? 15 : 0) +
          (revenue ? 10 : 0) +
          rows.reduce((s, r) => s + Number(r.health_score || 0), 0) / rows.length * 0.45
      )
    : 0;
  const viralityScore = clamp(engagementRate * 400 + (impressions ? 20 : 0));
  const engagementHealth = clamp(engagementRate * 350 + (rows.length ? 25 : 0));
  const conversionScore = spend
    ? clamp((conversions / Math.max(spend, 1)) * 400 + 20)
    : conversions
      ? clamp(50 + conversions)
      : 0;
  const roiMultiplier = spend > 0 ? Number((revenue / spend).toFixed(2)) : 0;

  const posts = rows.flatMap((r) =>
    (Array.isArray((r as any).posts) ? (r as any).posts : []).map((post: any) => ({
      ...post,
      platform: post.platform || r.platform,
    }))
  );
  const snapshotPosts = posts
    .filter((post: any) => post && post.id && !/last 24h/i.test(String(post.title || '')))
    .map((post: any) => ({
      id: post.id,
      title: String(post.title || post.caption || 'Untitled').slice(0, 120),
      platform: post.platform,
      postType: post.postType || 'Reel',
      postDate: post.postDate || post.timestamp || null,
      reach: Number(post.reach || 0),
      impressions: Number(post.impressions || 0),
      saves: Number(post.saves || 0),
      shares: Number(post.shares || 0),
      likes: Number(post.likes || 0),
      comments: Number(post.comments || 0),
      clicks: Number(post.clicks || 0),
      conversions: Number(post.conversions || 0),
      viralityScore: clamp(
        ((Number(post.saves || 0) + Number(post.shares || 0)) /
          Math.max(Number(post.impressions || post.reach || 1), 1)) *
          400
      ),
      status: Number(post.saves || 0) >= 20 ? 'performing' : 'underperforming',
      reboostRecommended: Number(post.reach || 0) > 0 && Number(post.saves || 0) < 5,
      hookText: String(post.hookText || post.title || post.caption || '').slice(0, 160),
      source: 'provider_media',
    }));

  const postReach = snapshotPosts.reduce((sum, post) => sum + Number(post.reach || 0), 0);
  const trendReach = reach || postReach;
  console.info('[insights] trend reach', {
    clientId,
    accountReach24h: reach,
    postReach,
    used: trendReach,
    engagement,
    revenue,
    connected: rows.map((r) => r.platform),
  });
  const month = new Date().toLocaleString('en-US', { month: 'short' });
  const trends = [
    {
      month,
      reach: trendReach,
      engagement,
      leads: conversions,
      conversions,
      revenue,
    },
  ];

  const totalReach = Math.max(reach, 1);
  const attribution = rows.map((r) => {
    const rReach = Number(r.reach_24h || r.impressions_24h || 0);
    const rEngage = Number(r.engagement_24h || 0);
    const rClicks = Number(r.clicks_24h || 0);
    const rConv = Number(r.conversions_30d || 0);
    const rRev = Number(r.revenue_30d || 0);
    const rSpend = Number(r.spend_30d || 0);
    return {
      id: r.id,
      channel: r.platform,
      contentTitle: `${r.account_name} paid + organic path`,
      totalRevenueGenerated: rRev,
      cac: rConv > 0 ? Number((rSpend / rConv).toFixed(2)) : 0,
      roas: rSpend > 0 ? Number((rRev / rSpend).toFixed(2)) : 0,
      touchpoints: [
        { stage: 'Content Impression', count: rReach || Number(r.impressions_24h || 0), conversionRatePct: 100 },
        {
          stage: 'Engagement/Save',
          count: rEngage,
          conversionRatePct: rReach ? Number(((rEngage / rReach) * 100).toFixed(1)) : 0,
        },
        {
          stage: 'Link Click',
          count: rClicks,
          conversionRatePct: rEngage ? Number(((rClicks / rEngage) * 100).toFixed(1)) : 0,
        },
        { stage: 'Lead Form', count: rConv, conversionRatePct: rClicks ? Number(((rConv / rClicks) * 100).toFixed(1)) : 0 },
        {
          stage: 'Sale Completed',
          count: rConv,
          conversionRatePct: rClicks ? Number(((rConv / rClicks) * 100).toFixed(1)) : 0,
        },
      ],
    };
  });

  const personas = personasFromDemographics(rows, clientId);

  const payload = {
    client_id: clientId,
    org_id: orgId,
    source: rows.length ? 'live_sync' : 'empty',
    growth_score: growthScore,
    virality_score: viralityScore,
    engagement_health: engagementHealth,
    sentiment_score: engagementHealth,
    conversion_score: conversionScore,
    roi_multiplier: roiMultiplier,
    trends,
    personas,
    attribution,
    posts: snapshotPosts,
    demographics: {
      followers,
      impressions,
      reach: trendReach,
      engagement,
      clicks,
      spend,
      conversions,
      revenue,
      notes: rows.map((r) => (r.demographics as any)?.note).filter(Boolean),
    },
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin.from('client_live_insights').upsert(payload);
  if (error) throw new Error(error.message);

  await admin
    .from('clients')
    .update({
      growth_score: growthScore,
      virality_score: viralityScore,
      engagement_health: engagementHealth,
      sentiment_score: engagementHealth,
      conversion_score: conversionScore,
      roi_multiplier: roiMultiplier,
      recent_growth_trends: trends,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clientId)
    .eq('org_id', orgId);

  return payload;
}

function personasFromDemographics(rows: any[], clientId: string) {
  const merged: Record<string, number> = {};
  const countries: Record<string, number> = {};
  const cities: Record<string, number> = {};
  const sources: string[] = [];

  for (const row of rows) {
    const demo = row.demographics || {};
    if (demo.source) sources.push(String(demo.source));
    for (const [key, value] of Object.entries({ ...(demo.ageGender || {}), ...(demo.adsAgeGender || {}) })) {
      merged[key] = (merged[key] || 0) + Number(value || 0);
    }
    for (const [key, value] of Object.entries(demo.countries || {})) {
      countries[key] = (countries[key] || 0) + Number(value || 0);
    }
    for (const [key, value] of Object.entries(demo.cities || {})) {
      cities[key] = (cities[key] || 0) + Number(value || 0);
    }
  }

  const resolved = Object.entries(merged)
    .map(([key, value]) => ({ key, value }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = resolved.reduce((s, r) => s + r.value, 0);
  if (!total) return [];

  const topCountry = Object.entries(countries).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topCity = Object.entries(cities).sort((a, b) => b[1] - a[1])[0]?.[0];
  const sourceLabel = sources[0] || 'connected_platform';

  return resolved.slice(0, 3).map((row, index) => {
    const [gender, age] = row.key.includes('.') ? row.key.split('.') : row.key.split(' · ');
    const ageRange = (age || row.key).replace(/^F\.|^M\.|^U\./, '').replace(/-/g, ' - ');
    const genderLabel = /^(F|female)/i.test(gender || row.key)
      ? 'Women'
      : /^(M|male)/i.test(gender || row.key)
        ? 'Men'
        : 'Audience';
    return {
      id: `${clientId}-demo-${index}`,
      name: `${genderLabel} ${ageRange}`,
      segmentName: sourceLabel.replace(/_/g, ' '),
      percentage: clamp((row.value / total) * 100, 1, 99),
      ageRange,
      activeHours: 'Not reported by the provider',
      interests: [topCountry, topCity, rows[0]?.platform].filter(Boolean),
      buyingTriggers: ['Reported by the connected ads/social audience breakdown'],
      preferredFormat: rows[0]?.platform === 'tiktok' ? 'Short-form video' : 'Feed + Reels',
      sentimentScore: 0,
      purchasingPower: 'Medium',
      source: 'provider_demographics',
    };
  });
}

export function campaignMetricsFromInsights(insights: any, _budget: number) {
  const d = insights?.demographics || {};
  const impressions = Number(d.impressions || 0);
  const engagements = Number(d.engagement || 0);
  const clicks = Number(d.clicks || 0);
  const leads = Number(d.conversions || 0);
  const conversions = Number(d.conversions || 0);
  const revenue = Number(d.revenue || 0);
  const spend = Number(d.spend || 0);
  const cvr = clicks ? Number(((conversions / clicks) * 100).toFixed(1)) : 0;
  const cac = conversions ? Number((spend / conversions).toFixed(2)) : 0;
  const roas = spend ? Number((revenue / spend).toFixed(2)) : 0;
  const progress = impressions ? clamp((conversions / Math.max(impressions, 1)) * 4000, 0, 100) : 0;
  const funnel = [
    { stageName: '1. Impressions', count: impressions, conversionRate: 100, dropoffRate: 0, description: 'Live last-sync impressions' },
    {
      stageName: '2. Engagement',
      count: engagements,
      conversionRate: impressions ? Number(((engagements / impressions) * 100).toFixed(1)) : 0,
      dropoffRate: impressions ? Number((100 - (engagements / impressions) * 100).toFixed(1)) : 0,
      description: 'Likes, comments, saves from connected APIs',
    },
    {
      stageName: '3. Clicks',
      count: clicks,
      conversionRate: engagements ? Number(((clicks / engagements) * 100).toFixed(1)) : 0,
      dropoffRate: engagements ? Number((100 - (clicks / engagements) * 100).toFixed(1)) : 0,
      description: 'Link and ad clicks',
    },
    {
      stageName: '4. Conversions / leads',
      count: leads,
      conversionRate: clicks ? Number(((leads / clicks) * 100).toFixed(1)) : 0,
      dropoffRate: clicks ? Number((100 - (leads / clicks) * 100).toFixed(1)) : 0,
      description: 'Ads conversions or GA4 conversions',
    },
    {
      stageName: '5. Revenue',
      count: Math.round(revenue),
      conversionRate: cvr,
      dropoffRate: 0,
      description: 'Reported conversion value',
    },
  ];
  return {
    currentProgress: progress,
    metrics: { impressions, engagements, clicks, leads, conversions, revenueGenerated: revenue, cvr, cac, roas },
    funnelStages: funnel,
  };
}
