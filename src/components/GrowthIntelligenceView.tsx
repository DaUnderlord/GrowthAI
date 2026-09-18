import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Check, ChevronDown, Sparkles } from 'lucide-react';
import { ClientProfile, ContentCalendarItem, Campaign } from '../types';
import { MultiAgentLabView } from './MultiAgentLabView';
import { PredictionEngineView } from './PredictionEngineView';
import { ContentOptimizerView } from './ContentOptimizerView';
import { CompetitorIntelligenceView } from './CompetitorIntelligenceView';
import { AutonomousReboostView } from './AutonomousReboostView';
import { CreativeLabView } from './CreativeLabView';
import { LiveAccountNote } from './LiveAccountNote';
import { DataLoader } from './DataLoader';
import { MetricLabel } from './MetricTip';
import { METRIC_TIPS, type MetricKey } from '../lib/metricExplain';
import { ConnectAccountsPrompt } from './ConnectAccountsPrompt';
import { useLiveInsights } from '../lib/liveApi';
import { saveCalendarItem, subscribeToCalendarItems, subscribeToCampaigns } from '../lib/supabase';
import { callGrowthAi, withBrandContext } from '../lib/aiApi';
import { formatLabel } from '../../shared/postFormat';
import {
  applyActionToItem,
  buildActions,
  buildPlaybook,
  buildRecap,
  formatMetric,
  recapStripLine,
  resolveCampaignGoal,
  type CalendarAction,
} from '../lib/growthStrategist';
import { todayInZone } from '../../shared/calendarPublish';

interface GrowthIntelligenceProps {
  client: ClientProfile;
}

type PrimaryTab = 'recap' | 'playbook' | 'actions';
type MoreTab = 'competitors' | 'reboost' | 'creative' | 'agents' | 'predict' | 'optimize';
type SuiteTab = PrimaryTab | MoreTab;

const PRIMARY: { id: PrimaryTab; label: string; metric: MetricKey }[] = [
  { id: 'recap', label: 'Recap', metric: 'aiRecap' },
  { id: 'playbook', label: 'Playbook', metric: 'aiPlaybook' },
  { id: 'actions', label: 'Actions', metric: 'aiActions' },
];

const MORE: { id: MoreTab; label: string; metric: MetricKey }[] = [
  { id: 'competitors', label: 'Competitors', metric: 'aiCompetitors' },
  { id: 'reboost', label: 'Reboost', metric: 'aiReboost' },
  { id: 'creative', label: 'Creative', metric: 'aiCreative' },
  { id: 'agents', label: 'Agents', metric: 'aiAgents' },
  { id: 'predict', label: 'Predict', metric: 'aiPredict' },
  { id: 'optimize', label: 'Optimize', metric: 'aiOptimize' },
];

const CHART_TOOLTIP = {
  backgroundColor: '#0d1520',
  borderColor: '#334155',
  borderRadius: '0.75rem',
  color: '#f8fafc',
};

function confidenceCopy(value: string) {
  if (value === 'too_few') return 'too few posts to call';
  if (value === 'low') return 'low (n 3–4)';
  if (value === 'medium') return 'medium (n 5–7)';
  return 'useful (n ≥ 8)';
}

export const GrowthIntelligenceView: React.FC<GrowthIntelligenceProps> = ({ client }) => {
  const [tab, setTab] = useState<SuiteTab>('recap');
  const [moreOpen, setMoreOpen] = useState(false);
  const [calendarItems, setCalendarItems] = useState<ContentCalendarItem[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { hookText: string; captionText: string }>>({});
  const [draftStatus, setDraftStatus] = useState<'idle' | 'loading' | 'ready' | 'fallback'>('idle');
  const { insights, loading } = useLiveInsights(client.id);

  useEffect(() => {
    setCalendarLoading(true);
    const unsubCal = subscribeToCalendarItems(client.id, (items) => {
      setCalendarItems(items);
      setCalendarLoading(false);
    });
    const unsubCamp = subscribeToCampaigns(client.id, setCampaigns);
    return () => {
      unsubCal();
      unsubCamp();
    };
  }, [client.id]);

  const goalText = useMemo(
    () => resolveCampaignGoal(client.primaryGoal, campaigns),
    [client.primaryGoal, campaigns]
  );

  const recap = useMemo(
    () =>
      buildRecap({
        posts: insights?.posts,
        calendar: calendarItems,
        personas: insights?.personas,
        followers: Number(insights?.demographics?.followers || 0),
        reach24h: Number(insights?.demographics?.reach || 0),
        adsSpend: Number(insights?.demographics?.spend || 0),
        updatedAt: insights?.updated_at,
      }),
    [insights, calendarItems]
  );

  const playbook = useMemo(
    () =>
      buildPlaybook({
        recap,
        goalText,
        conversionsTotal:
          recap.posts.reduce((sum, p) => sum + Number(p.conversions || 0) + Number(p.clicks || 0), 0) +
          Number(insights?.demographics?.spend ? 0 : 0),
      }),
    [recap, goalText, insights]
  );

  const actions = useMemo(
    () =>
      buildActions({
        recap,
        playbook,
        calendar: calendarItems,
        todayIso: todayInZone(),
        clientId: client.id,
        clientName: client.name,
      }),
    [recap, playbook, calendarItems, client.id, client.name]
  );

  useEffect(() => {
    console.info('[growth-ai] recap', {
      clientId: client.id,
      postCount: recap.postCount,
      formatsClassified: recap.formatsClassified,
      goalKind: playbook.goalKind,
      winner: playbook.winner ? `${playbook.winner.format}@${playbook.winner.platform} n=${playbook.winner.n}` : null,
      actionCount: actions.length,
    });
  }, [client.id, recap.postCount, recap.formatsClassified, playbook.goalKind, playbook.winner, actions.length]);

  useEffect(() => {
    if (tab !== 'actions' || !actions.length) {
      setDraftStatus('idle');
      return;
    }
    let cancelled = false;
    const run = async () => {
      setDraftStatus('loading');
      const result = await callGrowthAi<{
        drafts?: Array<{ actionId: string; hookText?: string; captionText?: string }>;
      }>(
        '/api/growth/draft-calendar-copy',
        withBrandContext(client, {
          goal: goalText,
          actions: actions.map((action) => ({
            actionId: action.id,
            kind: action.kind,
            topic: action.after.topic || action.before.topic,
            platform: action.platform,
            contentType: action.after.contentType || action.before.contentType,
            citePosts: action.citePosts,
          })),
        })
      );
      if (cancelled) return;
      if (!result.ok || !result.data?.drafts?.length) {
        console.info('[growth-ai] gemini copy fallback', { error: result.error || 'empty drafts' });
        setDraftStatus('fallback');
        return;
      }
      const next: Record<string, { hookText: string; captionText: string }> = {};
      for (const draft of result.data.drafts) {
        if (!draft?.actionId) continue;
        next[draft.actionId] = {
          hookText: String(draft.hookText || '').trim(),
          captionText: String(draft.captionText || '').trim(),
        };
      }
      setDrafts(next);
      setDraftStatus('ready');
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [tab, actions, client, goalText]);

  const resolvedAction = (action: CalendarAction): CalendarAction => {
    const draft = drafts[action.id];
    if (!draft?.hookText) return action;
    return {
      ...action,
      after: {
        ...action.after,
        hookText: draft.hookText,
        captionText: draft.captionText || action.after.captionText,
      },
    };
  };

  const handleApply = async (raw: CalendarAction) => {
    const action = resolvedAction(raw);
    setApplyingId(action.id);
    setApplyError(null);
    try {
      if (action.createItem) {
        const created: ContentCalendarItem = {
          ...action.createItem,
          id: action.createItem.id || `gos-rec-${Date.now()}`,
          hookText: action.after.hookText || action.createItem.hookText,
          captionText: action.after.captionText || action.createItem.captionText,
          topic: action.after.topic || action.createItem.topic,
          contentType: action.after.contentType || action.createItem.contentType,
          aiSuggestedHook: action.after.hookText,
          aiFeedback: action.after.aiFeedback,
          status: 'draft',
        };
        console.info('[growth-ai] apply create', { actionId: action.id, kind: action.kind, itemId: created.id });
        await saveCalendarItem(created);
      } else if (action.calendarItemId) {
        const existing = calendarItems.find((item) => item.id === action.calendarItemId);
        if (!existing) throw new Error('Calendar row is no longer in this workspace.');
        const updated = applyActionToItem(existing, action);
        console.info('[growth-ai] apply edit', {
          actionId: action.id,
          kind: action.kind,
          itemId: updated.id,
          status: updated.status,
        });
        await saveCalendarItem(updated);
      }
      setAppliedIds((ids) => [...ids, action.id]);
    } catch (err: any) {
      setApplyError(err?.message || 'Could not write to the calendar.');
    } finally {
      setApplyingId(null);
    }
  };

  const activeMetric: MetricKey =
    PRIMARY.find((row) => row.id === tab)?.metric || MORE.find((row) => row.id === tab)?.metric || 'aiRecap';
  const moreActive = MORE.some((row) => row.id === tab);
  const dataPending = (loading && !insights) || calendarLoading;

  return (
    <div className="fade-rise space-y-5">
      <div className="surface-panel p-5 sm:p-6">
        <p className="eyebrow-label">Growth AI</p>
        <h2 className="font-display mt-1 text-3xl font-medium text-white">Strategist for {client.name}</h2>
        <LiveAccountNote client={client} />
        <p className="mt-2 text-xs leading-5 text-slate-500">{METRIC_TIPS[activeMetric].body}</p>
        <div className="mt-4 flex flex-wrap items-center gap-1">
          {PRIMARY.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setMoreOpen(false);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs transition ${
                tab === t.id ? 'bg-[color:var(--accent-soft)] text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs transition ${
                moreActive ? 'bg-[color:var(--accent-soft)] text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              More
              <ChevronDown className="h-3 w-3" />
            </button>
            {moreOpen && (
              <div className="absolute left-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#0d1520] py-1 shadow-xl">
                {MORE.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTab(t.id);
                      setMoreOpen(false);
                    }}
                    className={`block w-full px-3 py-2 text-left text-xs ${
                      tab === t.id ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {tab === 'recap' && dataPending && <DataLoader label="Loading last-sync posts and calendar mix…" />}
      {tab === 'recap' && !dataPending && <RecapPanel recap={recap} playbook={playbook} client={client} />}
      {tab === 'playbook' && dataPending && <DataLoader label="Building playbook from last-sync posts…" />}
      {tab === 'playbook' && !dataPending && <PlaybookPanel playbook={playbook} recap={recap} />}
      {tab === 'actions' && dataPending && <DataLoader label="Comparing the calendar to the playbook…" />}
      {tab === 'actions' && !dataPending && (
        <ActionsPanel
          actions={actions}
          drafts={drafts}
          draftStatus={draftStatus}
          appliedIds={appliedIds}
          applyingId={applyingId}
          applyError={applyError}
          onApply={handleApply}
          recapEmpty={!recap.postCount}
          calendarEmpty={!calendarItems.length}
          client={client}
        />
      )}

      {tab === 'agents' && <MultiAgentLabView client={client} />}
      {tab === 'predict' && <PredictionEngineView client={client} />}
      {tab === 'optimize' && <ContentOptimizerView client={client} />}
      {tab === 'competitors' && <CompetitorIntelligenceView client={client} />}
      {tab === 'reboost' && <AutonomousReboostView client={client} />}
      {tab === 'creative' && <CreativeLabView client={client} />}
    </div>
  );
};

function RecapPanel({
  recap,
  playbook,
  client,
}: {
  recap: ReturnType<typeof buildRecap>;
  playbook: ReturnType<typeof buildPlaybook>;
  client: ClientProfile;
}) {
  return (
    <div className="space-y-5">
      {!recap.postCount && <ConnectAccountsPrompt client={client} needed={['meta']} />}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface-subtle p-4">
          <p className="text-xs text-slate-500">
            <MetricLabel metric="followers">Followers</MetricLabel>
            <span className="ml-1 text-[10px] text-slate-600">(point in time)</span>
          </p>
          <p className="font-display mt-2 text-3xl font-medium text-white">
            {recap.followers > 0 ? recap.followers.toLocaleString() : '—'}
          </p>
        </div>
        <div className="surface-subtle p-4">
          <p className="text-xs text-slate-500">
            <MetricLabel metric="reach">Post reach</MetricLabel>
          </p>
          <p className="font-display mt-2 text-3xl font-medium text-white">
            {recap.postReach > 0 ? recap.postReach.toLocaleString() : '—'}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">{recap.postCount} last-sync posts</p>
        </div>
        <div className="surface-subtle p-4">
          <p className="text-xs text-slate-500">
            <MetricLabel metric="engagement">Interactions</MetricLabel>
          </p>
          <p className="font-display mt-2 text-3xl font-medium text-white">
            {recap.interactions > 0 ? recap.interactions.toLocaleString() : '—'}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Likes + comments + saves + shares</p>
        </div>
      </div>

      <p className="text-sm leading-6 text-slate-400">
        {recapStripLine(recap, playbook)} {recap.periodLabel}.
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface-panel p-5">
          <p className="eyebrow-label">Format mix</p>
          <h3 className="mt-1 text-lg font-medium text-white">Last-sync posts</h3>
          {!recap.formatsClassified ? (
            <p className="mt-3 text-sm text-slate-500">
              Format unclassified on this snapshot. The next Sync reads Instagram media type (Reel vs carousel vs feed).
            </p>
          ) : (
            <div className="mt-5 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={recap.formatMix.map((row) => ({ name: formatLabel(row.format), count: row.count }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP} />
                  <Bar dataKey="count" fill="#8ec8d8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="surface-panel p-5">
          <p className="eyebrow-label">Performance by format</p>
          <h3 className="mt-1 text-lg font-medium text-white">Median reach</h3>
          {recap.performanceByFormat.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Need classified formats before this chart can compare Reels vs carousels.</p>
          ) : (
            <div className="mt-5 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={recap.performanceByFormat.map((row) => ({
                    name: `${formatLabel(row.format)} (n=${row.n})`,
                    reach: row.medianReach,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP} formatter={(val: any) => [Number(val).toLocaleString(), 'Median reach']} />
                  <Bar dataKey="reach" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <section className="surface-panel p-5">
        <p className="eyebrow-label">Reach over posts</p>
        <h3 className="mt-1 text-lg font-medium text-white">Each last-sync post</h3>
        {recap.reachOverPosts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No provider media in last sync.</p>
        ) : (
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={recap.reachOverPosts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={10} interval={0} angle={-18} textAnchor="end" height={60} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={CHART_TOOLTIP} formatter={(val: any) => [Number(val).toLocaleString(), 'Reach']} />
                <Line type="monotone" dataKey="reach" stroke="#8ec8d8" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="surface-panel p-5">
        <p className="eyebrow-label">Top content this period</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {recap.topPosts.length === 0 && (
            <p className="text-sm text-slate-500 sm:col-span-3">No posts to rank. Sync Instagram to fill this row.</p>
          )}
          {recap.topPosts.map((post) => (
            <div key={post.id} className="surface-subtle p-4">
              <p className="text-sm font-medium text-white">{post.title}</p>
              <p className="mt-2 text-xs text-slate-500">
                {formatLabel(post.format)} · {post.platform} · {post.postDate || 'undated'}
              </p>
              <p className="mt-3 text-lg font-semibold text-white">{Number(post.reach || 0).toLocaleString()}</p>
              <p className="text-[11px] text-slate-500">
                Reach · {Number(post.saves || 0)} saves · {Number(post.comments || 0)} comments
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface-panel p-5">
          <p className="eyebrow-label">Calendar mix</p>
          <h3 className="mt-1 text-lg font-medium text-white">Planned vs published</h3>
          {recap.calendarMix.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No calendar rows yet. Add posts on the calendar so Actions can write into them.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {recap.calendarMix.map((row) => (
                <div key={row.format}>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>{row.format}</span>
                    <span>
                      {row.planned} planned · {row.published} published
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full bg-cyan-400/70"
                      style={{
                        width: `${Math.min(100, ((row.planned + row.published) / Math.max(1, recap.calendarMix.reduce((s, r) => s + r.planned + r.published, 0))) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="surface-panel p-5">
          <p className="eyebrow-label">Audience</p>
          {recap.personas.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Age/gender appears after Instagram Insights returns a breakdown. Cities/countries stay hidden until present.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {recap.personas.map((persona) => (
                <div key={persona.name} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">
                    {persona.name}
                    {persona.ageRange ? ` · ${persona.ageRange}` : ''}
                  </span>
                  <span className="text-white">{persona.percentage}%</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <ul className="space-y-1.5 text-xs leading-5 text-slate-500">
        {recap.notes.map((note) => (
          <li key={note}>— {note}</li>
        ))}
      </ul>
    </div>
  );
}

function PlaybookPanel({
  playbook,
  recap,
}: {
  playbook: ReturnType<typeof buildPlaybook>;
  recap: ReturnType<typeof buildRecap>;
}) {
  return (
    <div className="space-y-5">
      <div className="surface-panel p-5 sm:p-6">
        <p className="eyebrow-label">What worked here</p>
        <h3 className="mt-1 text-xl font-medium text-white">
          Goal: {playbook.goalKind} · {playbook.metricLabel}
        </h3>
        <p className="mt-2 text-sm text-slate-400">{playbook.goalText}</p>
        <p className="mt-3 text-xs text-slate-500">
          Ranking is deterministic from last-sync posts. n &lt; 3 is not treated as a rule. This is not Meta’s ranking algorithm.
        </p>
      </div>

      <div className="surface-panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.06] text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Format</th>
              <th className="px-4 py-3 font-medium">Platform</th>
              <th className="px-4 py-3 font-medium">
                <MetricLabel metric="playbookN">n</MetricLabel>
              </th>
              <th className="px-4 py-3 font-medium">{playbook.metricLabel}</th>
              <th className="px-4 py-3 font-medium">
                <MetricLabel metric="playbookConfidence">Confidence</MetricLabel>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {playbook.rows.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-slate-500" colSpan={5}>
                  {recap.postCount
                    ? 'Posts are present but formats are unclassified, so nothing is ranked yet.'
                    : 'No last-sync posts to rank.'}
                </td>
              </tr>
            )}
            {playbook.rows.map((row) => (
              <tr key={`${row.platform}-${row.format}`} className={row.ranked ? '' : 'opacity-70'}>
                <td className="px-4 py-3 text-white">
                  {formatLabel(row.format)}
                  {playbook.winner?.format === row.format && playbook.winner.platform === row.platform ? (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-cyan-300">leader</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 capitalize text-slate-300">{row.platform}</td>
                <td className="px-4 py-3 text-slate-300">{row.n}</td>
                <td className="px-4 py-3 text-slate-200">
                  {row.confidence === 'too_few' ? '—' : formatMetric(row.medianMetric, playbook.goalKind)}
                </td>
                <td className="px-4 py-3 text-slate-400">{confidenceCopy(row.confidence)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-1.5 text-xs leading-5 text-slate-500">
        {playbook.caveats.map((note) => (
          <li key={note}>— {note}</li>
        ))}
      </ul>
    </div>
  );
}

function ActionsPanel({
  actions,
  drafts,
  draftStatus,
  appliedIds,
  applyingId,
  applyError,
  onApply,
  recapEmpty,
  calendarEmpty,
  client,
}: {
  actions: CalendarAction[];
  drafts: Record<string, { hookText: string; captionText: string }>;
  draftStatus: 'idle' | 'loading' | 'ready' | 'fallback';
  appliedIds: string[];
  applyingId: string | null;
  applyError: string | null;
  onApply: (action: CalendarAction) => void;
  recapEmpty: boolean;
  calendarEmpty: boolean;
  client: ClientProfile;
}) {
  return (
    <div className="space-y-4">
      {recapEmpty && <ConnectAccountsPrompt client={client} needed={['meta']} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          One-click writes into the calendar. Status stays scheduled or draft. Nothing is posted to Instagram from here.
        </p>
        {draftStatus === 'loading' && (
          <DataLoader variant="inline" label="Drafting hooks from named last-sync posts…" />
        )}
        {draftStatus === 'fallback' && (
          <p className="text-[11px] text-amber-200">Gemini unavailable — using last-sync hook patterns.</p>
        )}
        {draftStatus === 'ready' && (
          <p className="text-[11px] text-emerald-300/90">Hooks drafted from named last-sync posts.</p>
        )}
      </div>
      {applyError && <p className="text-xs text-amber-200">{applyError}</p>}
      {actions.length === 0 && (
        <div className="surface-panel p-6 text-sm text-slate-500">
          {calendarEmpty
            ? 'No calendar rows to edit. Add upcoming posts on the calendar, then come back to apply the playbook.'
            : 'Upcoming calendar rows already match the playbook, or last-sync does not yet support a format winner.'}
        </div>
      )}
      {actions.map((action) => {
        const applied = appliedIds.includes(action.id);
        const draft = drafts[action.id];
        const afterHook = draft?.hookText || action.after.hookText;
        const afterCaption = draft?.captionText || action.after.captionText;
        return (
          <div key={action.id} className="surface-panel space-y-4 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="eyebrow-label">{action.kind.replace('_', ' ')}</p>
                <h3 className="mt-1 text-lg font-medium text-white">{action.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{action.reason}</p>
                {action.crossPlatformNote && (
                  <p className="mt-2 text-[11px] text-amber-200">{action.crossPlatformNote}</p>
                )}
              </div>
              <button
                type="button"
                disabled={applied || applyingId === action.id}
                onClick={() => onApply(action)}
                className="primary-button self-start !py-1.5 text-xs"
              >
                {applied ? (
                  <span className="inline-flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Applied
                  </span>
                ) : applyingId === action.id ? (
                  <DataLoader variant="inline" label="Writing…" />
                ) : (
                  'Apply'
                )}
              </button>
            </div>

            {(action.before.contentType || action.before.hookText) && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="surface-subtle p-3">
                  <p className="text-[11px] text-slate-500">Before</p>
                  <p className="mt-1 text-sm text-slate-300">
                    {action.before.contentType || '—'}
                    {action.before.date ? ` · ${action.before.date}` : ''}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{action.before.hookText || action.before.topic || 'No hook yet'}</p>
                </div>
                <div className="surface-subtle p-3">
                  <p className="text-[11px] text-slate-500">After</p>
                  <p className="mt-1 text-sm text-white">
                    {action.after.contentType || action.before.contentType || '—'}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-300">{afterHook}</p>
                  {afterCaption && <p className="mt-2 text-[11px] leading-5 text-slate-500">{afterCaption}</p>}
                </div>
              </div>
            )}

            {action.citePosts.length > 0 && (
              <p className="text-[11px] text-slate-500">
                <Sparkles className="mr-1 inline h-3 w-3 text-cyan-300" />
                Cites {action.citePosts.map((post) => `“${post.title}”`).join(' · ')}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
