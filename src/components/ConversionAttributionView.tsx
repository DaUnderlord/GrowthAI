import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { ClientProfile } from '../types';
import { useLiveInsights } from '../lib/liveApi';
import { useWorkspaceLocale } from '../lib/WorkspaceLocale';
import { ConnectAccountsPrompt } from './ConnectAccountsPrompt';
import { MetricLabel } from './MetricTip';

interface ConversionAttributionProps {
  client: ClientProfile;
}

export const ConversionAttributionView: React.FC<ConversionAttributionProps> = ({ client }) => {
  const { insights } = useLiveInsights(client.id);
  const { t } = useWorkspaceLocale();
  const paths = useMemo(
    () => (insights?.attribution?.length ? insights.attribution : []),
    [insights]
  );
  const trends = insights?.trends?.length ? insights.trends : [];
  const latest = trends[trends.length - 1];
  const previous = trends[trends.length - 2];
  const revenue = Number(latest?.revenue || 0) || paths.reduce((s, p) => s + p.totalRevenueGenerated, 0);
  const leads = Number(latest?.leads || latest?.conversions || 0);
  const roi = Number(insights?.roi_multiplier ?? 0);
  const revDelta =
    previous?.revenue && previous.revenue > 0
      ? Math.round(((revenue - previous.revenue) / previous.revenue) * 100)
      : null;
  const avgCac = paths.length
    ? Math.round(paths.reduce((s, p) => s + p.cac, 0) / paths.length)
    : 0;
  const hasLive = insights?.source === 'live_sync';

  const topMetrics = [
    {
      label: 'Attributed revenue',
      metric: 'revenue' as const,
      value: `$${revenue.toLocaleString()}`,
      helper: revDelta != null ? `${revDelta >= 0 ? '+' : ''}${revDelta}% vs previous month` : 'Ads conversion value from last Sync — not invoices',
    },
    {
      label: 'Average CAC',
      metric: 'cac' as const,
      value: `$${avgCac}`,
      helper: 'Spend ÷ conversions on connected channels',
    },
    {
      label: 'Blended ROAS',
      metric: 'roas' as const,
      value: `${roi}x`,
      helper: 'Last-sync conversion value ÷ spend',
    },
    {
      label: 'Lead volume',
      metric: 'conversions' as const,
      value: leads ? leads.toLocaleString() : '—',
      helper: latest ? `${latest.month} last-sync conversions` : 'No conversions in last Sync',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="surface-panel p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow-label">{t('attribution')}</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Performance explained in plain terms</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Paths use last-sync reach, engagement, spend, and conversions for {client.name}. 0 spend means no ads account is selected yet.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-100">
            Tracking {client.name}
          </div>
        </div>
      </div>

      {!hasLive && <ConnectAccountsPrompt client={client} needed={['meta']} />}

      <div className="grid gap-3 md:grid-cols-4">
        {topMetrics.map((metric) => (
          <div key={metric.label} className="surface-panel p-4">
            <p className="text-xs text-slate-400">
              <MetricLabel metric={metric.metric}>{metric.label}</MetricLabel>
            </p>
            <p className="mt-3 text-2xl font-semibold text-white">{metric.value}</p>
            <p className="mt-2 text-xs text-slate-500">{metric.helper}</p>
          </div>
        ))}
      </div>

      <div className="surface-panel p-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-cyan-300" />
          <div>
            <p className="text-sm font-semibold text-white">Revenue paths</p>
            <p className="text-sm text-slate-400">How connected channels turn attention into conversions.</p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {!paths.length && hasLive && (
            <p className="text-sm text-slate-500">
              Last sync has no attributed conversions yet. Organic post reach is not a revenue path until ads or checkout events exist.
            </p>
          )}
          {paths.map((path) => (
            <div key={path.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="eyebrow-label">{path.channel} path</p>
                  <h3 className="mt-1 text-lg font-semibold text-white">{path.contentTitle}</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-emerald-200">
                    <MetricLabel metric="revenue">Total Rev: ${path.totalRevenueGenerated.toLocaleString()}</MetricLabel>
                  </span>
                  <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-cyan-200">
                    <MetricLabel metric="roas">ROAS: {path.roas}x</MetricLabel>
                  </span>
                  <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-slate-300">
                    <MetricLabel metric="cac">CAC: ${path.cac}</MetricLabel>
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-5">
                {path.touchpoints.map((tp, idx) => (
                  <div key={idx} className="surface-subtle p-4">
                    <p className="text-[11px] text-slate-500">{tp.stage}</p>
                    <p className="mt-2 text-lg font-semibold text-white">{tp.count.toLocaleString()}</p>
                    <p className="mt-2 text-[11px] text-emerald-300">{tp.conversionRatePct}% CVR</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
