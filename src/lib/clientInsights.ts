import { ClientProfile, ContentCalendarItem, PostPerformance, PlatformType } from '../types';

function contentTypeToPostType(contentType: string): PostPerformance['postType'] {
  const lower = contentType.toLowerCase();
  if (lower.includes('reel') || lower.includes('video')) return 'Reel';
  if (lower.includes('carousel')) return 'Carousel';
  if (lower.includes('story')) return 'Story';
  if (lower.includes('ad')) return 'Ad Campaign';
  return 'Article';
}

function platformFromString(value: string): PlatformType {
  const normalized = value.toLowerCase().replace(/\s+/g, '_') as PlatformType;
  const allowed: PlatformType[] = [
    'instagram',
    'facebook',
    'tiktok',
    'linkedin',
    'youtube',
    'google_analytics',
    'whatsapp',
    'meta_ads',
    'google_ads',
  ];
  return allowed.includes(normalized) ? normalized : 'instagram';
}

function statusFromScore(score: number, ageDays: number): PostPerformance['status'] {
  if (score >= 85) return 'viral';
  if (score >= 70) return ageDays > 21 ? 'decaying' : 'performing';
  return 'underperforming';
}

export function buildPostSignalsFromCalendar(
  items: ContentCalendarItem[],
  client: ClientProfile
): PostPerformance[] {
  const eligible = items.filter((item) =>
    ['published', 'scheduled', 'needs_correction'].includes(item.status)
  );

  if (eligible.length === 0) {
    return buildPostSignalsFromPlatforms(client);
  }

  const healthFactor = Math.max(client.engagementHealth, 20) / 100;

  return eligible
    .slice()
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
    .slice(0, 12)
    .map((item, index) => {
      const score = Math.round(item.aiScore || 72);
      const reach = Math.round(score * 420 * (healthFactor + 0.4));
      const impressions = Math.round(reach * 1.35);
      const saves = Math.round(reach * 0.04 * (score / 100));
      const shares = Math.round(reach * 0.018 * (score / 100));
      const clicks = Math.round(reach * 0.06);
      const conversions = Math.round(clicks * 0.08);
      const ageDays = Math.max(
        0,
        Math.floor((Date.now() - new Date(item.date).getTime()) / (1000 * 60 * 60 * 24))
      );
      const status = statusFromScore(score, ageDays);

      return {
        id: item.id,
        title: item.topic || item.hookText || `Calendar post ${index + 1}`,
        platform: platformFromString(item.platform),
        postType: contentTypeToPostType(item.contentType),
        postDate: item.date,
        reach,
        impressions,
        saves,
        shares,
        likes: Math.round(reach * 0.11),
        comments: Math.round(reach * 0.015),
        clicks,
        conversions,
        viralityScore: score,
        status,
        reboostRecommended: status === 'decaying' || (status === 'viral' && ageDays <= 7),
        hookText: item.hookText || item.topic || '',
      };
    });
}

export function buildPostSignalsFromPlatforms(client: ClientProfile): PostPerformance[] {
  const connected = client.platforms.filter((p) => p.connected);
  if (connected.length === 0) return [];

  return connected.slice(0, 6).map((platform, index) => {
    const score = Math.round(platform.healthScore || client.growthScore || 70);
    const reach = Math.round((platform.followers || 1000) * 0.08);
    return {
      id: `platform-${platform.id}-${index}`,
      title: `${platform.name} performance snapshot`,
      platform: platform.id,
      postType: 'Reel',
      postDate: new Date().toISOString().slice(0, 10),
      reach,
      impressions: Math.round(reach * 1.2),
      saves: Math.round(reach * 0.035),
      shares: Math.round(reach * 0.02),
      likes: Math.round(reach * 0.09),
      comments: Math.round(reach * 0.012),
      clicks: Math.round(reach * 0.05),
      conversions: Math.round(reach * 0.006),
      viralityScore: score,
      status: score >= 80 ? 'performing' : 'underperforming',
      reboostRecommended: (platform.growthRate || 0) >= 10,
      hookText: `Latest content on ${platform.accountName}`,
    };
  });
}

export function buildPostSignals(
  client: ClientProfile,
  calendarItems: ContentCalendarItem[] = []
): PostPerformance[] {
  const fromCalendar = buildPostSignalsFromCalendar(calendarItems, client);
  if (fromCalendar.length > 0) return fromCalendar;
  return buildPostSignalsFromPlatforms(client);
}

export function computeOverviewInsights(client: ClientProfile) {
  const connectedPlatforms = client.platforms.filter((p) => p.connected);
  const avgGrowth =
    connectedPlatforms.length > 0
      ? connectedPlatforms.reduce((sum, p) => sum + (p.growthRate || 0), 0) / connectedPlatforms.length
      : 0;

  return [
    {
      title: connectedPlatforms.length
        ? 'Connected channel momentum'
        : 'Connect social accounts to track momentum',
      meta: avgGrowth > 0 ? `+${avgGrowth.toFixed(1)}%` : `${client.growthScore}/100`,
      body: connectedPlatforms.length
        ? `${connectedPlatforms.length} live channel(s) synced for ${client.name}. Growth score is a workspace formula from last Sync (reach, engagement, conversions, health) — not a Meta forecast.`
        : 'Link Instagram, TikTok, or other channels in Agency Hub to populate live growth signals.',
    },
    {
      title: 'Revenue efficiency',
      meta: `${client.roiMultiplier || 0}x ROI`,
      body: 'ROAS is last-sync ads conversion value ÷ spend. 0x means no ads account is selected or Meta returned no purchase value — not hospital billing.',
    },
    {
      title: 'Audience engagement health',
      meta: `${client.engagementHealth}/100`,
      body: 'Likes, comments, and saves versus reach from last Sync. Sentiment currently copies this number.',
    },
  ];
}

export function parseCalendarAuditMarkdown(markdown: string): {
  overallScore: number;
  strengths: string[];
  gapsAndWeaknesses: string[];
  suggestedCorrectionsCount: number;
} {
  const scoreMatch = markdown.match(/(?:quality\s*score|overall\s*score)[^\d]*(\d{1,3})/i);
  const overallScore = scoreMatch ? Math.min(100, Number(scoreMatch[1])) : 78;

  const strengths: string[] = [];
  const gapsAndWeaknesses: string[] = [];
  let section: 'none' | 'strengths' | 'gaps' = 'none';

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim();
    if (/strength/i.test(line)) {
      section = 'strengths';
      continue;
    }
    if (/weakness|gap|critical/i.test(line)) {
      section = 'gaps';
      continue;
    }
    if (/^#+\s/.test(line) || /^(\d+\.|\*|-)\s/.test(line) === false && section !== 'none' && line.length > 8) {
      if (section === 'strengths') strengths.push(line.replace(/^(\d+\.|\*|-)\s*/, ''));
      if (section === 'gaps') gapsAndWeaknesses.push(line.replace(/^(\d+\.|\*|-)\s*/, ''));
    }
    if (/^(\d+\.|\*|-)\s/.test(line)) {
      const text = line.replace(/^(\d+\.|\*|-)\s*/, '');
      if (section === 'strengths') strengths.push(text);
      if (section === 'gaps') gapsAndWeaknesses.push(text);
    }
  }

  const suggestedCorrectionsCount = gapsAndWeaknesses.length || (overallScore < 80 ? 3 : 0);

  return {
    overallScore,
    strengths: strengths.slice(0, 5),
    gapsAndWeaknesses: gapsAndWeaknesses.slice(0, 5),
    suggestedCorrectionsCount,
  };
}

export const GROWTH_AGENT_ROSTER = [
  { id: 'analyst', name: 'Data Analyst', role: 'Performance & attribution', avatar: '📊' },
  { id: 'social', name: 'Social Growth', role: 'Reach & distribution', avatar: '📣' },
  { id: 'content', name: 'Content Strategist', role: 'Messaging & pillars', avatar: '✍️' },
  { id: 'conversion', name: 'Conversion', role: 'Funnels & CTAs', avatar: '🎯' },
  { id: 'competitor', name: 'Competitor Research', role: 'Whitespace & gaps', avatar: '🔍' },
  { id: 'optimizer', name: 'Campaign Optimizer', role: 'Budget & pacing', avatar: '⚙️' },
  { id: 'reporting', name: 'Executive Reporting', role: 'Summaries & KPIs', avatar: '📈' },
];
