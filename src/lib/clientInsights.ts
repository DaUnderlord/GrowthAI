import { ClientProfile } from '../types';

export function computeOverviewInsights(
  client: ClientProfile,
  live?: {
    hasLive?: boolean;
    channels?: string[];
    postCount?: number;
    followers?: number;
  }
) {
  const connectedPlatforms = (client.platforms || []).filter((p) => p.connected);
  const liveChannels = [...new Set((live?.channels || []).filter(Boolean))];
  const fromLive = Boolean(live?.hasLive || (live?.postCount || 0) > 0 || (live?.followers || 0) > 0);
  const channelNames = connectedPlatforms.length
    ? connectedPlatforms.map((p) => p.accountName || p.name || p.id)
    : liveChannels;
  const connectedCount = connectedPlatforms.length || liveChannels.length || (fromLive ? 1 : 0);
  const avgGrowth =
    connectedPlatforms.length > 0
      ? connectedPlatforms.reduce((sum, p) => sum + (p.growthRate || 0), 0) / connectedPlatforms.length
      : 0;

  const label = channelNames.length
    ? channelNames.map((name) => String(name).replace(/^@/, '')).join(' · ')
    : '';

  return [
    {
      title: connectedCount
        ? `${label || 'Connected accounts'} last-sync`
        : 'Connect social accounts to track momentum',
      meta: avgGrowth > 0 ? `+${avgGrowth.toFixed(1)}%` : `${client.growthScore}/100`,
      body: connectedCount
        ? `${connectedCount} account${connectedCount === 1 ? '' : 's'} synced for ${client.name}${
            live?.postCount ? ` · ${live.postCount} recent posts` : ''
          }${live?.followers ? ` · ${live.followers.toLocaleString()} followers` : ''}. TikTok is optional. Ads stay at 0 until you pick a Meta Ads account.`
        : 'Link Instagram, Facebook, or other channels in Agency Hub and tap Sync.',
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
  const overallScore = scoreMatch ? Math.min(100, Number(scoreMatch[1])) : 0;

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

  const suggestedCorrectionsCount = gapsAndWeaknesses.length;

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
