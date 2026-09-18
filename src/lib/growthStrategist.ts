import {
  calendarTypeFromFormat,
  formatLabel,
  mapProviderPostType,
  type ProviderPostFormat,
} from '../../shared/postFormat';
import type { Campaign, ContentCalendarItem, PostPerformance } from '../types';

export type GoalKind = 'followers' | 'engagement' | 'conversions';
export type PlaybookConfidence = 'too_few' | 'low' | 'medium' | 'useful';
export type CalendarActionKind = 'change_format' | 'rewrite_hook' | 'split_topic' | 'add_reel' | 'reboost';

export type LivePost = PostPerformance & { format: ProviderPostFormat };

export type FormatMixRow = { format: ProviderPostFormat; count: number; pct: number };
export type FormatPerformanceRow = {
  format: ProviderPostFormat;
  n: number;
  medianReach: number;
  medianSaves: number;
  medianComments: number;
};

export type PlaybookRow = {
  format: ProviderPostFormat;
  platform: string;
  n: number;
  medianMetric: number;
  metricLabel: string;
  confidence: PlaybookConfidence;
  sampleLabel: string;
  ranked: boolean;
};

export type RecapModel = {
  periodLabel: string;
  followers: number;
  followerIsPointInTime: true;
  postCount: number;
  postReach: number;
  interactions: number;
  posts: LivePost[];
  formatMix: FormatMixRow[];
  performanceByFormat: FormatPerformanceRow[];
  reachOverPosts: Array<{ id: string; label: string; reach: number; date: string }>;
  topPosts: LivePost[];
  calendarMix: Array<{ format: string; planned: number; published: number }>;
  platformCounts: Array<{ platform: string; postCount: number }>;
  personas: Array<{ name: string; percentage: number; ageRange?: string }>;
  notes: string[];
  formatsClassified: boolean;
};

export type PlaybookModel = {
  goalKind: GoalKind;
  goalText: string;
  metricLabel: string;
  canOptimize: boolean;
  rows: PlaybookRow[];
  winner: PlaybookRow | null;
  caveats: string[];
};

export type CalendarAction = {
  id: string;
  kind: CalendarActionKind;
  calendarItemId?: string;
  title: string;
  reason: string;
  platform: string;
  citePosts: Array<{ id: string; title: string; hookText: string; reach: number; saves: number }>;
  before: {
    contentType?: string;
    hookText?: string;
    topic?: string;
    platform?: string;
    date?: string;
  };
  after: {
    contentType?: ContentCalendarItem['contentType'];
    hookText?: string;
    captionText?: string;
    topic?: string;
    aiFeedback: string;
  };
  createItem?: Omit<ContentCalendarItem, 'id'> & { id?: string };
  crossPlatformNote?: string;
};

export function median(values: number[]): number {
  const nums = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!nums.length) return 0;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

export function confidenceFromN(n: number): PlaybookConfidence {
  if (n < 3) return 'too_few';
  if (n < 5) return 'low';
  if (n < 8) return 'medium';
  return 'useful';
}

export function classifyGoal(text: string): GoalKind {
  const t = String(text || '').toLowerCase();
  if (/lead|sale|convert|book|purchas|revenue|roas|cac|funnel|enroll/.test(t)) return 'conversions';
  if (/engag|communit|save|comment|share|conversat/.test(t)) return 'engagement';
  return 'followers';
}

export function realLivePosts(posts?: PostPerformance[] | null): LivePost[] {
  return (posts || [])
    .filter((post) => post && post.id && !/last 24h/i.test(String(post.title || '')))
    .map((post) => {
      const hasMediaHint = Boolean(post.media_type || post.media_product_type);
      const format =
        post.source === 'provider_media' && !hasMediaHint ? 'Unknown' : mapProviderPostType(post);
      return { ...post, format };
    });
}

export function goalMetricValue(post: LivePost, kind: GoalKind): number {
  if (kind === 'followers') return Number(post.reach || 0);
  if (kind === 'conversions') return Number(post.conversions || 0) + Number(post.clicks || 0);
  const reach = Number(post.reach || 0);
  const engagement = Number(post.saves || 0) + Number(post.comments || 0);
  return reach > 0 ? engagement / reach : engagement;
}

export function metricLabelForGoal(kind: GoalKind): string {
  if (kind === 'followers') return 'median reach';
  if (kind === 'conversions') return 'median clicks + conversions';
  return 'median (saves + comments) / reach';
}

export function fallbackHookDraft(topic: string, cite?: { title?: string; hookText?: string }): string {
  const seed = String(cite?.hookText || cite?.title || '')
    .trim()
    .split('\n')[0]
    .slice(0, 90);
  const topicBit = String(topic || '').trim() || 'this topic';
  if (seed) return `${seed.replace(/[.?!]+$/, '')} — ${topicBit}`;
  return `What we saw on the last-sync posts, applied to ${topicBit}`;
}

export function fallbackCaptionDraft(topic: string, cite?: { title?: string; hookText?: string }): string {
  const cited = String(cite?.hookText || cite?.title || '').trim();
  const topicBit = String(topic || '').trim();
  if (cited && topicBit) return `${topicBit}. Pattern taken from last-sync post: “${cited.slice(0, 120)}”.`;
  if (topicBit) return topicBit;
  return cited.slice(0, 180);
}

function groupCount<T extends string>(items: T[]): Array<{ key: T; count: number }> {
  const map = new Map<T, number>();
  for (const item of items) map.set(item, (map.get(item) || 0) + 1);
  return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

export function buildRecap(input: {
  posts?: PostPerformance[] | null;
  calendar?: ContentCalendarItem[] | null;
  personas?: Array<{ name: string; percentage: number; ageRange?: string }> | null;
  followers?: number;
  reach24h?: number;
  adsSpend?: number;
  updatedAt?: string | null;
  platformPostCounts?: Array<{ platform: string; postCount: number }>;
}): RecapModel {
  const posts = realLivePosts(input.posts);
  const calendar = input.calendar || [];
  const classified = posts.filter((p) => p.format !== 'Unknown');
  const mixSource = classified.length ? classified : [];
  const mix = groupCount(mixSource.map((p) => p.format));
  const formatMix: FormatMixRow[] = mix.map((row) => ({
    format: row.key,
    count: row.count,
    pct: mixSource.length ? Math.round((row.count / mixSource.length) * 100) : 0,
  }));

  const formats = [...new Set(mixSource.map((p) => p.format))];
  const performanceByFormat: FormatPerformanceRow[] = formats.map((format) => {
    const rows = mixSource.filter((p) => p.format === format);
    return {
      format,
      n: rows.length,
      medianReach: median(rows.map((p) => Number(p.reach || 0))),
      medianSaves: median(rows.map((p) => Number(p.saves || 0))),
      medianComments: median(rows.map((p) => Number(p.comments || 0))),
    };
  });

  const reachOverPosts = [...posts]
    .sort((a, b) => String(a.postDate || '').localeCompare(String(b.postDate || '')))
    .map((post) => ({
      id: post.id,
      label: String(post.title || 'Post').slice(0, 28),
      reach: Number(post.reach || 0),
      date: String(post.postDate || ''),
    }));

  const topPosts = [...posts].sort((a, b) => Number(b.reach || 0) - Number(a.reach || 0)).slice(0, 3);

  const calendarMixMap = new Map<string, { planned: number; published: number }>();
  for (const item of calendar) {
    const format = formatLabel(mapProviderPostType({ postType: item.contentType }));
    const row = calendarMixMap.get(format) || { planned: 0, published: 0 };
    if (item.status === 'published') row.published += 1;
    else row.planned += 1;
    calendarMixMap.set(format, row);
  }

  const platformCounts =
    input.platformPostCounts ||
    groupCount(posts.map((p) => String(p.platform || 'unknown'))).map((row) => ({
      platform: row.key,
      postCount: row.count,
    }));

  const notes: string[] = [];
  if (!posts.length) notes.push('No last-sync provider posts yet. Connect the brand and tap Sync.');
  if (posts.length && classified.length === 0) {
    notes.push('Format is unclassified on this snapshot. The next Sync will read Instagram media_type (Reel vs carousel vs feed).');
  }
  const fb = platformCounts.find((row) => row.platform === 'facebook');
  if (!fb || fb.postCount === 0) notes.push('Facebook has 0 posts in last sync — do not treat Instagram results as Facebook tactics.');
  if (!Number(input.adsSpend || 0)) notes.push('Ads results stay unknown until a Meta Ads account is selected.');
  if (Number(input.reach24h || 0) === 0 && posts.some((p) => Number(p.reach || 0) > 0)) {
    notes.push('Account-level 24h reach is 0; Recap uses per-post reach from last-sync media instead.');
  }
  notes.push('Best time of day is unknown — that field is not in the snapshot.');
  notes.push('Follower count is a point in time from last sync, not a monthly growth trend.');

  const updated = input.updatedAt ? new Date(input.updatedAt) : null;
  const periodLabel = updated && !Number.isNaN(updated.getTime())
    ? `Last sync ${updated.toLocaleString()}`
    : 'Last sync / last 30 days of provider media';

  return {
    periodLabel,
    followers: Number(input.followers || 0),
    followerIsPointInTime: true,
    postCount: posts.length,
    postReach: posts.reduce((sum, p) => sum + Number(p.reach || 0), 0),
    interactions: posts.reduce(
      (sum, p) => sum + Number(p.likes || 0) + Number(p.comments || 0) + Number(p.saves || 0) + Number(p.shares || 0),
      0
    ),
    posts,
    formatMix,
    performanceByFormat,
    reachOverPosts,
    topPosts,
    calendarMix: [...calendarMixMap.entries()].map(([format, counts]) => ({ format, ...counts })),
    platformCounts,
    personas: (input.personas || []).slice(0, 4),
    notes,
    formatsClassified: classified.length > 0,
  };
}

export function buildPlaybook(input: {
  recap: RecapModel;
  goalText: string;
  conversionsTotal?: number;
}): PlaybookModel {
  const goalKind = classifyGoal(input.goalText);
  const metricLabel = metricLabelForGoal(goalKind);
  const posts = input.recap.posts;
  const conversionsTotal =
    input.conversionsTotal ?? posts.reduce((sum, p) => sum + Number(p.conversions || 0) + Number(p.clicks || 0), 0);
  const canOptimize = goalKind !== 'conversions' || conversionsTotal > 0;

  const groups = new Map<string, LivePost[]>();
  for (const post of posts) {
    const key = `${post.platform || 'unknown'}::${post.format}`;
    const list = groups.get(key) || [];
    list.push(post);
    groups.set(key, list);
  }

  const rows: PlaybookRow[] = [...groups.entries()].map(([key, list]) => {
    const [platform, format] = key.split('::') as [string, ProviderPostFormat];
    const n = list.length;
    const confidence = format === 'Unknown' ? 'too_few' : confidenceFromN(n);
    return {
      format,
      platform,
      n,
      medianMetric: median(list.map((p) => goalMetricValue(p, goalKind))),
      metricLabel,
      confidence,
      sampleLabel: `${n} ${formatLabel(format)}${n === 1 ? '' : 's'} on ${platform}`,
      ranked: confidence !== 'too_few',
    };
  }).sort((a, b) => b.medianMetric - a.medianMetric);

  const ranked = rows.filter((row) => row.ranked);
  const winner = canOptimize ? ranked[0] || null : null;

  const caveats: string[] = [];
  if (!posts.length) caveats.push('No last-sync posts — Playbook cannot rank formats yet.');
  if (posts.length && !input.recap.formatsClassified) {
    caveats.push('Too few classified formats to call. Rank after the next Sync includes Reel vs carousel vs feed.');
  }
  if (!canOptimize) {
    caveats.push('Conversions and clicks are 0 on last-sync posts (and ads are unselected). This Playbook cannot optimize a leads/sales goal yet.');
  }
  for (const row of rows) {
    if (row.confidence === 'too_few' && row.format !== 'Unknown') {
      caveats.push(`${row.sampleLabel} — too few posts to call.`);
    }
  }
  const igCount = posts.filter((p) => p.platform === 'instagram').length;
  const fbCount = posts.filter((p) => p.platform === 'facebook').length;
  if (igCount > 0 && fbCount === 0) {
    caveats.push('Winner is from Instagram last-sync only. Facebook had 0 posts — do not copy this onto Facebook without saying so.');
  }
  if (winner) {
    caveats.unshift(
      `${formatLabel(winner.format)} on ${winner.platform}: ${winner.sampleLabel}, ${metricLabel} ${formatMetric(winner.medianMetric, goalKind)}.`
    );
  }

  return { goalKind, goalText: input.goalText, metricLabel, canOptimize, rows, winner, caveats };
}

export function formatMetric(value: number, kind: GoalKind): string {
  if (kind === 'engagement') {
    if (value === 0) return '0';
    if (value < 1) return `${(value * 100).toFixed(1)}%`;
    return value.toFixed(2);
  }
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(Math.round(value));
}

function upcomingItems(calendar: ContentCalendarItem[], todayIso: string): ContentCalendarItem[] {
  return calendar.filter((item) => {
    if (item.status === 'published') return false;
    const date = String(item.date || '');
    return !date || date >= todayIso;
  });
}

function citeTop(posts: LivePost[], kind: GoalKind, n = 2) {
  return [...posts]
    .sort((a, b) => goalMetricValue(b, kind) - goalMetricValue(a, kind))
    .slice(0, n)
    .map((post) => ({
      id: post.id,
      title: String(post.title || 'Untitled'),
      hookText: String(post.hookText || post.title || ''),
      reach: Number(post.reach || 0),
      saves: Number(post.saves || 0),
    }));
}

function normalizeTopic(topic: string): string {
  return String(topic || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function buildActions(input: {
  recap: RecapModel;
  playbook: PlaybookModel;
  calendar: ContentCalendarItem[];
  todayIso: string;
  clientId: string;
  clientName: string;
}): CalendarAction[] {
  const { recap, playbook, calendar, todayIso, clientId, clientName } = input;
  const upcoming = upcomingItems(calendar, todayIso);
  const cites = citeTop(recap.posts, playbook.goalKind, 2);
  const winner = playbook.winner;
  const actions: CalendarAction[] = [];
  const fbCount = recap.posts.filter((p) => p.platform === 'facebook').length;
  const igNote =
    fbCount === 0 && recap.posts.some((p) => p.platform === 'instagram')
      ? 'Cited posts are Instagram last-sync; Facebook had 0 posts.'
      : undefined;

  const winnerType = winner ? calendarTypeFromFormat(winner.format) : null;
  const upcomingOnWinnerPlatform = winner
    ? upcoming.filter((item) => item.platform === winner.platform || (winner.platform === 'instagram' && item.platform === 'instagram'))
    : upcoming;
  const winnerShare = winnerType
    ? upcomingOnWinnerPlatform.filter((item) => item.contentType === winnerType).length
    : upcomingOnWinnerPlatform.length;
  const mixOffGoal =
    Boolean(winnerType) &&
    upcomingOnWinnerPlatform.length > 0 &&
    winnerShare / upcomingOnWinnerPlatform.length < 0.4;

  if (winnerType && mixOffGoal) {
    const mismatches = upcomingOnWinnerPlatform.filter((item) => item.contentType !== winnerType).slice(0, 2);
    for (const item of mismatches) {
      const cite = cites[0];
      actions.push({
        id: `fmt-${item.id}`,
        kind: 'change_format',
        calendarItemId: item.id,
        title: `Turn “${item.topic}” into a ${winnerType}`,
        reason: `${winner!.sampleLabel} beat the other classified formats on ${playbook.metricLabel} (${formatMetric(winner!.medianMetric, playbook.goalKind)}). Upcoming mix is ${winnerShare}/${upcomingOnWinnerPlatform.length} ${winnerType}s vs the ${playbook.goalKind} goal.`,
        platform: item.platform,
        citePosts: cites,
        before: {
          contentType: item.contentType,
          hookText: item.hookText,
          topic: item.topic,
          platform: item.platform,
          date: item.date,
        },
        after: {
          contentType: winnerType,
          hookText: fallbackHookDraft(item.topic, cite),
          captionText: fallbackCaptionDraft(item.topic, cite),
          aiFeedback: `Format aligned to last-sync playbook (${winner!.sampleLabel}). Not a Meta ranking claim.`,
        },
        crossPlatformNote: item.platform === 'facebook' ? igNote : undefined,
      });
    }
  }

  for (const item of upcoming.slice(0, 8)) {
    const hook = String(item.hookText || '').trim();
    if (hook.length >= 18) continue;
    if (actions.some((row) => row.calendarItemId === item.id && row.kind === 'change_format')) continue;
    const cite = cites[0];
    actions.push({
      id: `hook-${item.id}`,
      kind: 'rewrite_hook',
      calendarItemId: item.id,
      title: `Rewrite hook for “${item.topic}”`,
      reason: cite
        ? `Hook is short or empty. Pattern taken from last-sync post “${cite.title}” (reach ${cite.reach.toLocaleString()}, saves ${cite.saves}).`
        : 'Hook is short or empty and there are no last-sync posts to copy yet.',
      platform: item.platform,
      citePosts: cites,
      before: {
        contentType: item.contentType,
        hookText: item.hookText,
        topic: item.topic,
        platform: item.platform,
        date: item.date,
      },
      after: {
        hookText: fallbackHookDraft(item.topic, cite),
        captionText: fallbackCaptionDraft(item.topic, cite),
        aiFeedback: cite
          ? `Hook rewritten from last-sync post “${cite.title}”. Gemini may polish language; ranking stayed deterministic.`
          : 'No last-sync post to cite — process-only rewrite.',
      },
      crossPlatformNote: item.platform === 'facebook' ? igNote : undefined,
    });
  }

  const seen = new Map<string, ContentCalendarItem>();
  for (const item of upcoming) {
    const key = normalizeTopic(item.topic);
    if (!key || key.length < 8) continue;
    const prior = seen.get(key);
    if (prior && !actions.some((row) => row.calendarItemId === item.id && row.kind === 'split_topic')) {
      const cite = cites[1] || cites[0];
      actions.push({
        id: `split-${item.id}`,
        kind: 'split_topic',
        calendarItemId: item.id,
        title: `Split the repeated topic “${item.topic}”`,
        reason: `“${prior.date}” and “${item.date}” share the same topic. Give this row a narrower angle so the calendar is not repeating one idea.`,
        platform: item.platform,
        citePosts: cites,
        before: { contentType: item.contentType, hookText: item.hookText, topic: item.topic, date: item.date, platform: item.platform },
        after: {
          topic: cite ? `${item.topic} — ${String(cite.title).slice(0, 48)}` : `${item.topic} (specific proof)`,
          hookText: fallbackHookDraft(`${item.topic} (specific proof)`, cite),
          aiFeedback: 'Split a repeated calendar topic. Status stays scheduled/draft.',
        },
      });
      if (actions.filter((row) => row.kind === 'split_topic').length >= 1) break;
    }
    seen.set(key, item);
  }

  if (winnerType && upcoming.length === 0 && recap.posts.length) {
    const cite = cites[0];
    const date = addDaysIso(todayIso, 2);
    actions.push({
      id: 'add-reel-empty',
      kind: 'add_reel',
      title: `Add a draft ${winnerType} for ${clientName}`,
      reason: `Playbook leader is ${winner!.sampleLabel}, but the calendar has no upcoming rows to apply it to.`,
      platform: winner!.platform,
      citePosts: cites,
      before: {},
      after: {
        contentType: winnerType,
        hookText: fallbackHookDraft(clientName, cite),
        captionText: fallbackCaptionDraft(`${clientName} follow-up`, cite),
        topic: cite ? `Follow-up: ${cite.title}`.slice(0, 80) : `${winnerType} from last-sync playbook`,
        aiFeedback: `Draft added from last-sync playbook. Time of day is unknown — not a best-hour claim. Status is draft; publish still goes through the calendar.`,
      },
      createItem: {
        clientId,
        date,
        dayOfWeek: weekdayName(date),
        time: '12:00',
        platform: (winner!.platform as ContentCalendarItem['platform']) || 'instagram',
        contentType: winnerType,
        topic: cite ? `Follow-up: ${cite.title}`.slice(0, 80) : `${winnerType} from last-sync playbook`,
        hookText: fallbackHookDraft(clientName, cite),
        captionText: fallbackCaptionDraft(`${clientName} follow-up`, cite),
        cta: '',
        status: 'draft',
        aiScore: 0,
        aiFeedback: 'Draft from Growth AI playbook. Not auto-published.',
      },
    });
  }

  const reboostPosts = recap.posts.filter((p) => p.reboostRecommended).slice(0, 2);
  for (const post of reboostPosts) {
    const date = addDaysIso(todayIso, 1);
    actions.push({
      id: `reboost-${post.id}`,
      kind: 'reboost',
      title: `Follow up “${String(post.title).slice(0, 48)}”`,
      reason: `Last-sync post still has reach (${Number(post.reach || 0).toLocaleString()}) and saves ${Number(post.saves || 0)} (workspace rule: reach > 0 and saves < 5). This is not proof paid will work.`,
      platform: String(post.platform || 'instagram'),
      citePosts: [
        {
          id: post.id,
          title: String(post.title || 'Untitled'),
          hookText: String(post.hookText || post.title || ''),
          reach: Number(post.reach || 0),
          saves: Number(post.saves || 0),
        },
      ],
      before: {},
      after: {
        contentType: calendarTypeFromFormat(post.format === 'Unknown' ? 'Reel' : post.format),
        hookText: fallbackHookDraft(String(post.title || 'follow-up'), post),
        captionText: fallbackCaptionDraft(`Follow-up to ${post.title}`, post),
        topic: `Follow-up: ${String(post.title || 'last-sync post')}`.slice(0, 80),
        aiFeedback: 'Follow-up draft from a last-sync post with reach and low saves. Ads stay off until a Meta Ads account is selected.',
      },
      createItem: {
        clientId,
        date,
        dayOfWeek: weekdayName(date),
        time: '12:00',
        platform: (post.platform as ContentCalendarItem['platform']) || 'instagram',
        contentType: calendarTypeFromFormat(post.format === 'Unknown' ? 'Reel' : post.format),
        topic: `Follow-up: ${String(post.title || 'last-sync post')}`.slice(0, 80),
        hookText: fallbackHookDraft(String(post.title || 'follow-up'), post),
        captionText: fallbackCaptionDraft(`Follow-up to ${post.title}`, post),
        cta: '',
        status: 'draft',
        aiScore: 0,
        aiFeedback: 'Follow-up draft. Not auto-published. Ads not placed.',
      },
    });
  }

  return actions.slice(0, 8);
}

export function applyActionToItem(item: ContentCalendarItem, action: CalendarAction): ContentCalendarItem {
  const status = item.status === 'published' ? item.status : item.status;
  return {
    ...item,
    contentType: action.after.contentType || item.contentType,
    hookText: action.after.hookText || item.hookText,
    captionText: action.after.captionText || item.captionText,
    topic: action.after.topic || item.topic,
    aiSuggestedHook: action.after.hookText || item.aiSuggestedHook,
    aiFeedback: action.after.aiFeedback || item.aiFeedback,
    status,
  };
}

export function recapStripLine(recap: RecapModel, playbook: PlaybookModel): string {
  if (!recap.postCount) return `No last-sync posts yet for the ${playbook.goalKind} goal.`;
  if (!recap.formatsClassified) {
    return `${recap.postCount} last-sync posts · format unclassified · ${playbook.goalKind} goal.`;
  }
  const parts = recap.formatMix.map((row) => `${row.count} ${formatLabel(row.format)}${row.count === 1 ? '' : 's'}`);
  if (playbook.winner) {
    return `${parts.join(' vs ')} · ${formatLabel(playbook.winner.format)} leads on ${playbook.metricLabel} (${formatMetric(playbook.winner.medianMetric, playbook.goalKind)}).`;
  }
  return `${parts.join(' vs ')} · too few posts to call a format winner.`;
}

export function resolveCampaignGoal(clientGoal: string, campaigns?: Campaign[] | null): string {
  const active = (campaigns || []).find((c) => c.status === 'active' && c.primaryGoal);
  return String(active?.primaryGoal || clientGoal || 'Grow followers');
}

function addDaysIso(todayIso: string, days: number): string {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(todayIso) ? new Date(`${todayIso}T12:00:00`) : new Date();
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

function weekdayName(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()] || 'Monday';
}
