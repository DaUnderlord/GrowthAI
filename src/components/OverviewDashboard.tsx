import React, { useState } from 'react';
import { ClientProfile, CurrencyCode } from '../types';
import { formatCurrency } from '../utils/currency';
import { computeOverviewInsights } from '../lib/clientInsights';
import { useLiveInsights } from '../lib/liveApi';
import { useWorkspaceLocale } from '../lib/WorkspaceLocale';
import { ConnectAccountsPrompt } from './ConnectAccountsPrompt';
import { MetricLabel } from './MetricTip';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface OverviewDashboardProps {
  client: ClientProfile;
  currency?: CurrencyCode;
  onNavigateTab: (tabId: string) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  client,
  currency = 'NGN',
  onNavigateTab,
}) => {
  const [attentionOpen, setAttentionOpen] = useState(false);
  const { insights: live } = useLiveInsights(client.id);
  const { t } = useWorkspaceLocale();
  const hasLive = live?.source === 'live_sync';
  const score = hasLive ? live?.growth_score ?? 0 : 0;
  const trends = hasLive && live?.trends?.length ? live.trends : [];
  const liveClient = { ...client, growthScore: score, recentGrowthTrends: trends, roiMultiplier: hasLive ? live?.roi_multiplier ?? 0 : 0, engagementHealth: hasLive ? live?.engagement_health ?? 0 : 0 };

  const insights = computeOverviewInsights(liveClient);

  const primary = insights[0];
  const rest = insights.slice(1);

  return (
    <div className="fade-rise space-y-8">
      <section className="surface-panel p-6 sm:p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow-label">{t('overview')}</p>
            <h1 className="page-title mt-2">{client.name}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
              One place to see momentum, then move into the work that matters.
            </p>
            <div className="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm text-slate-400">
              <p>
                <span className="text-slate-500">{t('goal')} </span>
                <span className="text-slate-200">{client.primaryGoal}</span>
              </p>
              <p>
                <span className="text-slate-500">{t('budget')} </span>
                <span className="text-slate-200">{formatCurrency(client.monthlyBudget, currency as CurrencyCode)}</span>
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <p className="text-xs text-slate-500">
              <MetricLabel metric="growthScore" align="right">
                {t('growthScore')}
              </MetricLabel>
            </p>
            <p className="font-display mt-1 text-5xl font-medium tracking-tight text-white">
              {score}
              <span className="text-2xl text-slate-500">/100</span>
            </p>
            <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <button onClick={() => onNavigateTab('campaigns')} className="primary-button">
                {t('continueCampaigns')}
              </button>
              <button onClick={() => onNavigateTab('calendar')} className="text-link">
                {t('reviewSchedule')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {!hasLive && <ConnectAccountsPrompt client={client} />}

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="reveal-panel">
          <button
            type="button"
            onClick={() => setAttentionOpen((v) => !v)}
            className="flex w-full items-start justify-between gap-4 p-5 text-left transition hover:bg-white/[0.02]"
          >
            <div>
              <p className="eyebrow-label">{t('needsAttention')}</p>
              <p className="mt-3 text-base font-medium text-white">{primary.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{primary.body}</p>
            </div>
            <span className="shrink-0 text-sm text-[color:var(--accent)]">{primary.meta}</span>
          </button>

          {attentionOpen && (
            <div className="border-t border-white/[0.06]">
              {rest.map((item) => (
                <div key={item.title} className="border-b border-white/[0.04] px-5 py-4 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="mt-1.5 text-xs leading-5 text-slate-400">{item.body}</p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">{item.meta}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-white/[0.06] px-5 py-3">
            <button
              type="button"
              onClick={() => setAttentionOpen((v) => !v)}
              className="text-link text-xs"
            >
              {attentionOpen ? 'Show less' : 'Show more insights'}
            </button>
          </div>
        </section>

        <section className="surface-panel p-5">
          <p className="eyebrow-label">Performance</p>
          <h2 className="font-display mt-2 text-2xl font-medium text-white">
            <MetricLabel metric="reach24h">Reach</MetricLabel>
            {' & '}
            <MetricLabel metric="revenue">revenue</MetricLabel>
          </h2>
          {!trends?.length && (
            <p className="mt-3 text-xs text-slate-500">{t('noLiveData')}</p>
          )}
          <div className="mt-5 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8ec8d8" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#8ec8d8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickFormatter={(val) =>
                    `${val >= 1000000 ? (val / 1000000).toFixed(1) + 'M' : (val / 1000).toFixed(0) + 'k'}`
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0d1520',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#f8fafc',
                  }}
                  formatter={(val: any) => [typeof val === 'number' ? val.toLocaleString() : val, '']}
                />
                <Area
                  type="monotone"
                  dataKey="reach"
                  stroke="#8ec8d8"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorReach)"
                  name="Reach"
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                  name="Revenue"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
};
