import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { ClientProfile, ConversionPath, PlatformType } from '../types';
import { useLiveInsights } from '../lib/liveApi';
import { useWorkspaceLocale } from '../lib/WorkspaceLocale';
import { ConnectAccountsPrompt } from './ConnectAccountsPrompt';

interface ConversionAttributionProps {
  client: ClientProfile;
}

function buildPathsForClient(client: ClientProfile): ConversionPath[] {
  const trends = client.recentGrowthTrends || [];
  const latest = trends[trends.length - 1];
  const revenue = latest?.revenue || client.monthlyBudget * (client.roiMultiplier || 3);
  const leads = latest?.leads || Math.round(client.monthlyBudget / 8);
  const conversions = latest?.conversions || Math.round(leads * 0.2);
  const platforms = (client.platforms || []).filter((p) => p.connected).slice(0, 3);

  const makeTouchpoints = (reach: number, engage: number, pathLeads: number, pathConv: number) =>
    [
      {
        stage: 'Content Impression' as const,
        count: reach,
        conversionRatePct: 100,
      },
      {
        stage: 'Engagement/Save' as const,
        count: engage,
        conversionRatePct: reach ? Number(((engage / reach) * 100).toFixed(1)) : 0,
      },
      {
        stage: 'Link Click' as const,
        count: Math.round(engage * 0.22),
        conversionRatePct: 22,
      },
      {
        stage: 'Lead Form' as const,
        count: pathLeads,
        conversionRatePct: 18,
      },
      {
        stage: 'Sale Completed' as const,
        count: pathConv,
        conversionRatePct: pathLeads ? Number(((pathConv / pathLeads) * 100).toFixed(1)) : 0,
      },
    ];

  if (!platforms.length) {
    return [
      {
        id: `${client.id}-instagram`,
        channel: 'instagram' as PlatformType,
        contentTitle: `${client.name} organic demand path`,
        totalRevenueGenerated: revenue,
        roas: client.roiMultiplier || 3,
        cac: Math.max(8, Math.round((client.monthlyBudget || 1000) / Math.max(conversions, 1))),
        touchpoints: makeTouchpoints(latest?.reach || 50000, latest?.engagement || 5000, leads, conversions),
      },
    ];
  }

  return platforms.map((platform, idx) => {
    const share = idx === 0 ? 0.48 : idx === 1 ? 0.32 : 0.2;
    const pathRevenue = Math.round(revenue * share);
    const pathLeads = Math.round(leads * share);
    const pathConv = Math.round(conversions * share);
    const reach = Math.round((latest?.reach || 80000) * share);
    const engage = Math.round((latest?.engagement || 8000) * share);
    return {
      id: `${client.id}-${platform.id}`,
      channel: platform.id,
      contentTitle: `${platform.accountName || platform.name} → ${client.primaryGoal.split(' ')[0]}`,
      totalRevenueGenerated: pathRevenue,
      roas: Number(((client.roiMultiplier || 3) * (1 + (platform.growthRate || 0) / 100)).toFixed(1)),
      cac: Math.max(6, Math.round((client.monthlyBudget * share) / Math.max(pathConv, 1))),
      touchpoints: makeTouchpoints(reach, engage, pathLeads, pathConv),
    };
  });
}

export const ConversionAttributionView: React.FC<ConversionAttributionProps> = ({ client }) => {
  const { insights } = useLiveInsights(client.id);
  const { t } = useWorkspaceLocale();
  const paths = useMemo(
    () => (insights?.attribution?.length ? insights.attribution : []),
    [insights]
  );
  const trends = client.recentGrowthTrends || [];
  const latest = trends[trends.length - 1];
  const previous = trends[trends.length - 2];
  const revenue = latest?.revenue || paths.reduce((s, p) => s + p.totalRevenueGenerated, 0);
  const leads = latest?.leads || 0;
  const revDelta =
    previous?.revenue && previous.revenue > 0
      ? Math.round(((revenue - previous.revenue) / previous.revenue) * 100)
      : null;
  const avgCac = paths.length
    ? Math.round(paths.reduce((s, p) => s + p.cac, 0) / paths.length)
    : 0;

  const topMetrics = [
    {
      label: 'Attributed revenue',
      value: `$${revenue.toLocaleString()}`,
      helper: revDelta != null ? `${revDelta >= 0 ? '+' : ''}${revDelta}% vs previous month` : 'From client growth trends',
    },
    {
      label: 'Average CAC',
      value: `$${avgCac}`,
      helper: 'Blended across connected channels',
    },
    {
      label: 'Blended ROAS',
      value: `${client.roiMultiplier}x`,
      helper: 'Client ROI multiplier',
    },
    {
      label: 'Lead volume',
      value: leads ? leads.toLocaleString() : '—',
      helper: latest ? `${latest.month} performance` : 'Add trend data on client',
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
              Paths and metrics are computed from {client.name}&apos;s platforms and growth trends.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-100">
            Tracking {client.name}
          </div>
        </div>
      </div>

      {!paths.length && <ConnectAccountsPrompt client={client} />}

      <div className="grid gap-3 md:grid-cols-4">
        {topMetrics.map((metric) => (
          <div key={metric.label} className="surface-panel p-4">
            <p className="text-xs text-slate-400">{metric.label}</p>
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
          {paths.map((path) => (
            <div key={path.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="eyebrow-label">{path.channel} path</p>
                  <h3 className="mt-1 text-lg font-semibold text-white">{path.contentTitle}</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-emerald-200">
                    Total Rev: ${path.totalRevenueGenerated.toLocaleString()}
                  </span>
                  <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-cyan-200">
                    ROAS: {path.roas}x
                  </span>
                  <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-slate-300">
                    CAC: ${path.cac}
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
