import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ClientProfile, PostPerformance } from '../types';
import { MultiAgentLabView } from './MultiAgentLabView';
import { PredictionEngineView } from './PredictionEngineView';
import { ContentOptimizerView } from './ContentOptimizerView';
import { CompetitorIntelligenceView } from './CompetitorIntelligenceView';
import { AutonomousReboostView } from './AutonomousReboostView';
import { callGrowthAi, withBrandContext } from '../lib/aiApi';
import { useLiveInsights } from '../lib/liveApi';
import { CreativeLabView } from './CreativeLabView';
import { LiveAccountNote } from './LiveAccountNote';
import { DataLoader } from './DataLoader';
import { MetricLabel } from './MetricTip';
import { METRIC_TIPS, type MetricKey } from '../lib/metricExplain';

interface GrowthIntelligenceProps {
  client: ClientProfile;
}

type SuiteTab = 'signals' | 'agents' | 'predict' | 'optimize' | 'competitors' | 'reboost' | 'creative';

function buildLocalInsights(post: PostPerformance, client: ClientProfile): string {
  const saveRate = post.impressions ? ((post.saves / post.impressions) * 100).toFixed(1) : '0';
  const shareRate = post.impressions ? ((post.shares / post.impressions) * 100).toFixed(1) : '0';
  const cvr = post.clicks ? ((post.conversions / post.clicks) * 100).toFixed(1) : '0';
  const statusLine =
    post.status === 'viral'
      ? 'This piece is in viral territory — prioritize amplification before the decay window.'
      : post.status === 'performing'
        ? 'Solid performer. Iterate the format and test a stronger CTA variant.'
        : post.status === 'decaying'
          ? 'Momentum is fading. Consider a reboost creative or new hook angle.'
          : 'Underperforming vs account baselines — refresh hook and thumbnail first.';

  return [
    `### AI insight · ${post.title}`,
    '',
    `**Client context:** ${client.name} (${client.industryLabel}) — goal: ${client.primaryGoal}.`,
    '',
    `**Hook:** “${post.hookText}”`,
    `- Last-sync metrics: reach ${post.reach.toLocaleString()} · saves ${post.saves.toLocaleString()} (${saveRate}% of impressions) · shares ${post.shares.toLocaleString()} (${shareRate}%).`,
    '',
    `**Performance read:** ${statusLine}`,
    `- Reach ${post.reach.toLocaleString()} · Clicks ${post.clicks.toLocaleString()} · Conversions ${post.conversions.toLocaleString()} (${cvr}% click→convert).`,
    '',
    '**What to do next**',
    post.reboostRecommended
      ? '1. Flagged because reach exists and saves are under 5 — a workspace rule, not proof paid will work. Reboost only after a Meta Ads account is selected.'
      : '1. Hold paid; use comments on this post to brief the next caption.',
    '2. Spin 2 hook variants (curiosity + proof) keeping the same core promise.',
    `3. Align CTA to ${client.name}'s primary goal — move viewers into the booked/lead path faster.`,
    '4. Package a carousel or Story follow-up that answers the top comment objections.',
  ].join('\n');
}

export const GrowthIntelligenceView: React.FC<GrowthIntelligenceProps> = ({ client }) => {
  const [tab, setTab] = useState<SuiteTab>('signals');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [insightText, setInsightText] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);
  const { insights, loading } = useLiveInsights(client.id);

  const posts = useMemo(
    () => (insights?.posts?.length ? insights.posts : []),
    [insights]
  );

  const aggregateReach = useMemo(
    () => posts.reduce((sum, p) => sum + p.reach, 0),
    [posts]
  );
  const aggregateSaveRate = useMemo(() => {
    const impressions = posts.reduce((sum, p) => sum + p.impressions, 0);
    const saves = posts.reduce((sum, p) => sum + p.saves, 0);
    return impressions > 0 ? ((saves / impressions) * 100).toFixed(1) : '0.0';
  }, [posts]);

  const tabs: { id: SuiteTab; label: string; metric: MetricKey }[] = [
    { id: 'signals', label: 'Signals', metric: 'aiSignals' },
    { id: 'agents', label: 'Agents', metric: 'aiAgents' },
    { id: 'predict', label: 'Predict', metric: 'aiPredict' },
    { id: 'optimize', label: 'Optimize', metric: 'aiOptimize' },
    { id: 'competitors', label: 'Competitors', metric: 'aiCompetitors' },
    { id: 'reboost', label: 'Reboost', metric: 'aiReboost' },
    { id: 'creative', label: 'Creative', metric: 'aiCreative' },
  ];

  const selectedPost = useMemo(
    () => posts.find((p) => p.id === selectedPostId) || null,
    [posts, selectedPostId]
  );

  useEffect(() => {
    if (!selectedPost) {
      setInsightText(null);
      setInsightError(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setInsightLoading(true);
      setInsightError(null);
      setInsightText(null);

      const fallback = buildLocalInsights(selectedPost, client);

      try {
        const result = await callGrowthAi<{ optimization: string }>('/api/growth/optimize-content', withBrandContext(client, {
          topic: selectedPost.title,
          channel: selectedPost.platform,
          goal: client.primaryGoal,
          audience: `${client.industryLabel} audience for ${client.name}`,
          hook: selectedPost.hookText,
          postType: selectedPost.postType,
          metrics: {
            reach: selectedPost.reach,
            saves: selectedPost.saves,
            shares: selectedPost.shares,
            viralityScore: selectedPost.viralityScore,
            status: selectedPost.status,
            conversions: selectedPost.conversions,
          },
        }));
        if (cancelled) return;
        if (!result.ok) {
          setInsightText(fallback);
          setInsightError(`${result.error} — showing GrowthOS heuristic insights.`);
        } else if (result.data.optimization) {
          setInsightText(
            `### AI insight · ${selectedPost.title}\n\n${result.data.optimization}\n\n---\n_Baseline metrics_\n${fallback.split('**Performance read:**')[1] || ''}`
          );
        } else {
          setInsightText(fallback);
        }
      } catch {
        if (!cancelled) {
          setInsightText(fallback);
          setInsightError('Live model unavailable — showing GrowthOS heuristic insights.');
        }
      } finally {
        if (!cancelled) setInsightLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [selectedPost, client]);

  const renderInsightBody = (text: string) => {
    return text.split('\n').map((line, idx) => {
      if (line.startsWith('### ')) {
        return (
          <h3 key={idx} className="font-display text-xl font-medium text-white">
            {line.replace(/^###\s*/, '')}
          </h3>
        );
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return (
          <p key={idx} className="mt-3 text-sm font-semibold text-cyan-100">
            {line.replace(/\*\*/g, '')}
          </p>
        );
      }
      if (line.startsWith('**')) {
        const parts = line.split('**');
        return (
          <p key={idx} className="mt-2 text-sm leading-6 text-slate-300">
            {parts.map((part, i) =>
              i % 2 === 1 ? (
                <span key={i} className="font-semibold text-white">
                  {part}
                </span>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
          </p>
        );
      }
      if (line.startsWith('- ') || /^\d+\.\s/.test(line)) {
        return (
          <p key={idx} className="mt-1.5 text-sm leading-6 text-slate-300">
            {line}
          </p>
        );
      }
      if (!line.trim()) return <div key={idx} className="h-2" />;
      return (
        <p key={idx} className="text-sm leading-6 text-slate-400">
          {line}
        </p>
      );
    });
  };

  return (
    <div className="fade-rise space-y-5">
      <div className="surface-panel p-5 sm:p-6">
        <p className="eyebrow-label">Growth AI Suite</p>
        <h2 className="font-display mt-1 text-3xl font-medium text-white">Intelligence for {client.name}</h2>
        <LiveAccountNote client={client} />
        <p className="mt-2 text-xs leading-5 text-slate-500">{METRIC_TIPS[tabs.find((row) => row.id === tab)?.metric || 'aiSignals'].body}</p>
        <div className="mt-4 flex flex-wrap gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-xs transition ${
                tab === t.id
                  ? 'bg-[color:var(--accent-soft)] text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'signals' && loading && !insights ? (
        <DataLoader label="Loading last-sync posts…" />
      ) : tab === 'signals' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="surface-subtle p-4">
              <p className="text-xs text-slate-500">
                <MetricLabel metric="reach">Reach (tracked posts)</MetricLabel>
              </p>
              <p className="font-display mt-2 text-3xl font-medium text-white">
                {aggregateReach > 0 ? aggregateReach.toLocaleString() : '—'}
              </p>
            </div>
            <div className="surface-subtle p-4">
              <p className="text-xs text-slate-500">
                <MetricLabel metric="saveRate">Save rate</MetricLabel>
              </p>
              <p className="font-display mt-2 text-3xl font-medium text-white">
                {posts.length > 0 && Number(aggregateSaveRate) > 0 ? `${aggregateSaveRate}%` : '—'}
              </p>
            </div>
          </div>

          <div className="surface-panel overflow-hidden">
            <div className="border-b border-white/[0.06] px-5 py-4">
              <p className="eyebrow-label">Recent content</p>
              <p className="mt-1 text-xs text-slate-500">Click a tile to open AI insights for that post.</p>
            </div>
            {posts.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500">
                Add calendar posts or connect social accounts in Agency Hub to populate signals.
              </div>
            ) : (
            <div className="divide-y divide-white/[0.05]">
              {posts.map((post) => {
                const selected = selectedPostId === post.id;
                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => setSelectedPostId(selected ? null : post.id)}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition sm:px-5 ${
                      selected
                        ? 'bg-[color:var(--accent-soft)]'
                        : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{post.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        <MetricLabel metric="postType">{post.postType}</MetricLabel>
                        {' · '}
                        <MetricLabel metric="reach">Reach {post.reach.toLocaleString()}</MetricLabel>
                      </p>
                    </div>
                    <span className="text-[11px] capitalize text-slate-500">
                      <MetricLabel metric="postStatus" align="right">
                        {post.status}
                      </MetricLabel>
                    </span>
                  </button>
                );
              })}
            </div>
            )}
          </div>

          {selectedPost && (
            <div className="surface-panel space-y-4 p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="eyebrow-label inline-flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                    Content AI insights
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-white">{selectedPost.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedPost.postType} · {selectedPost.platform} · {selectedPost.postDate}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPostId(null)}
                  className="secondary-button self-start !py-1.5 text-xs"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="surface-subtle p-3">
                  <p className="text-[11px] text-slate-500">
                    <MetricLabel metric="viralityScore">Virality</MetricLabel>
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">{selectedPost.viralityScore}%</p>
                </div>
                <div className="surface-subtle p-3">
                  <p className="text-[11px] text-slate-500">
                    <MetricLabel metric="saves">Saves</MetricLabel>
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">{selectedPost.saves.toLocaleString()}</p>
                </div>
                <div className="surface-subtle p-3">
                  <p className="text-[11px] text-slate-500">
                    <MetricLabel metric="clicks">Clicks</MetricLabel>
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">{selectedPost.clicks.toLocaleString()}</p>
                </div>
                <div className="surface-subtle p-3">
                  <p className="text-[11px] text-slate-500">
                    <MetricLabel metric="conversions">Conversions</MetricLabel>
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {selectedPost.conversions.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                {insightLoading && (
                  <DataLoader variant="inline" label="Generating AI insights for this post…" />
                )}
                {!insightLoading && insightError && (
                  <p className="mb-3 text-[11px] text-amber-200">{insightError}</p>
                )}
                {!insightLoading && insightText && (
                  <div className="space-y-1">{renderInsightBody(insightText)}</div>
                )}
              </div>

              {selectedPost.reboostRecommended && (
                <button
                  type="button"
                  onClick={() => setTab('reboost')}
                  className="primary-button"
                >
                  Open Reboost for this content
                </button>
              )}
            </div>
          )}
        </div>
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
