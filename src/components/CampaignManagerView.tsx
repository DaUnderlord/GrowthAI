import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { Campaign, CampaignObjective, CampaignType, ClientProfile } from '../types';
import {
  deleteCampaign,
  saveCampaign,
  subscribeToCampaigns,
} from '../lib/supabase';
import { callGrowthAi } from '../lib/aiApi';

interface CampaignManagerProps {
  client: ClientProfile;
}

export const CampaignManagerView: React.FC<CampaignManagerProps> = ({ client }) => {
  const [campaignList, setCampaignList] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterObjective, setFilterObjective] = useState<'all' | CampaignObjective>('all');
  const [generatingFunnel, setGeneratingFunnel] = useState(false);
  const [funnelAiOutput, setFunnelAiOutput] = useState<string | null>(null);
  const [funnelError, setFunnelError] = useState<string | null>(null);
  const [retargetingActivated, setRetargetingActivated] = useState<Record<string, boolean>>({});
  const [syncStatus, setSyncStatus] = useState<'local' | 'live'>('local');

  const [newCampName, setNewCampName] = useState('');
  const [newCampType, setNewCampType] = useState<CampaignType>('sales_conversion');
  const [newCampObjective, setNewCampObjective] = useState<CampaignObjective>('sales');
  const [newCampGoal, setNewCampGoal] = useState('');
  const [newCampBudget, setNewCampBudget] = useState(8500);
  const [newCampTarget, setNewCampTarget] = useState('100 qualified leads');

  const [deletingCampId, setDeletingCampId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'funnel' | 'retargeting'>('overview');

  useEffect(() => {
    setFunnelAiOutput(null);
    setRetargetingActivated({});
    const unsubscribe = subscribeToCampaigns(client.id, (campaigns) => {
      setCampaignList(campaigns);
      setSyncStatus('live');
      setSelectedCampaign((prev) => {
        if (prev) {
          const found = campaigns.find((c) => c.id === prev.id);
            if (found) {
            setFunnelAiOutput(found.aiNotes || null);
            const map: Record<string, boolean> = {};
            (found.retargetingPools || []).forEach((p) => {
              map[p.id] = Boolean(p.activated);
            });
            setRetargetingActivated(map);
            return found;
          }
        }
        const first = campaigns[0] || null;
        setFunnelAiOutput(first?.aiNotes || null);
        return first;
      });
    });

    return () => unsubscribe();
  }, [client.id]);

  const objectiveMeta: Record<CampaignObjective, { label: string; description: string }> = {
    followers: { label: 'Grow Followers', description: 'Increase audience size and creator momentum' },
    lead_generation: { label: 'Generate Leads', description: 'Capture qualified prospects and inbound intent' },
    sales: { label: 'Drive Sales', description: 'Convert demand into purchases or bookings' },
    awareness: { label: 'Build Awareness', description: 'Expand visibility across key channels' },
    retention: { label: 'Retain Warm Leads', description: 'Nurture returning audiences and remarketing pools' },
  };

  const filteredCampaigns = campaignList.filter((campaign) =>
    filterObjective === 'all' ? true : campaign.objective === filterObjective
  );

  const objectiveSummary = useMemo(() => {
    const counts: Record<'all' | CampaignObjective, number> = {
      all: campaignList.length,
      followers: 0,
      lead_generation: 0,
      sales: 0,
      awareness: 0,
      retention: 0,
    };

    for (const campaign of campaignList) {
      counts[campaign.objective] += 1;
    }

    return counts;
  }, [campaignList]);

  const handleDeleteCampaign = async (id: string) => {
    const updated = campaignList.filter((c) => c.id !== id);
    setCampaignList(updated);
    setDeletingCampId(null);
    if (selectedCampaign?.id === id) {
      setSelectedCampaign(updated[0] || null);
    }
    try {
      await deleteCampaign(id);
      setSyncStatus('live');
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampName || !newCampGoal) return;

    const newCampObj: Campaign = {
      id: `camp-${Date.now()}`,
      clientId: client.id,
      name: newCampName,
      type: newCampType,
      objective: newCampObjective,
      objectiveLabel: objectiveMeta[newCampObjective].label,
      status: 'active',
      primaryGoal: newCampGoal,
      primaryMetric: newCampTarget,
      budget: Number(newCampBudget),
      startDate: '2026-08-01',
      endDate: '2026-09-30',
      targetMetric: newCampTarget,
      currentProgress: 15,
      channels: ['instagram', 'tiktok', 'meta_ads'],
      metrics: {
        impressions: 45000,
        engagements: 4800,
        clicks: 890,
        leads: 180,
        conversions: 35,
        revenueGenerated: 12250,
        cvr: 19.4,
        cac: 18.20,
        roas: 4.2,
      },
      funnelStages: newCampType === 'sales_conversion' ? [
        { stageName: '1. Ad & Reel Impression', count: 45000, conversionRate: 100, dropoffRate: 0, description: 'Top-of-funnel reach' },
        { stageName: '2. Post Engagement / Reel Save', count: 4800, conversionRate: 10.6, dropoffRate: 89.4, description: 'Engagement & video retention' },
        { stageName: '3. Link Click', count: 890, conversionRate: 18.5, dropoffRate: 81.5, description: 'Landing page traffic' },
        { stageName: '4. DM Keyword Lead Magnet', count: 180, conversionRate: 20.2, dropoffRate: 79.8, description: 'Auto-responder trigger' },
        { stageName: '5. Purchase / Consultation', count: 35, conversionRate: 19.4, dropoffRate: 80.6, description: 'Converted customers' },
      ] : undefined,
    };

    setCampaignList([newCampObj, ...campaignList]);
    setSelectedCampaign(newCampObj);
    setShowCreateModal(false);
    setNewCampName('');
    setNewCampGoal('');
    setNewCampTarget('100 qualified leads');

    try {
      await saveCampaign(newCampObj);
      setSyncStatus('live');
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateFunnelStrategy = async () => {
    if (!selectedCampaign) return;
    setGeneratingFunnel(true);
    setFunnelError(null);
    try {
      const result = await callGrowthAi<{ funnelStrategy: string }>('/api/growth/generate-campaign-funnel', {
        campaignName: selectedCampaign.name,
        primaryGoal: selectedCampaign.primaryGoal,
        targetAudience: 'High-Intent Prospects',
        budget: selectedCampaign.budget,
      });
      if (!result.ok) {
        setFunnelError(result.error);
      } else if (result.data.funnelStrategy) {
        setFunnelAiOutput(result.data.funnelStrategy);
        const updated = { ...selectedCampaign, aiNotes: result.data.funnelStrategy as string };
        setSelectedCampaign(updated);
        setCampaignList((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        await saveCampaign(updated);
        setSyncStatus('live');
      }
    } catch (err: any) {
      setFunnelError(err?.message || 'Funnel strategy generation failed');
    } finally {
      setGeneratingFunnel(false);
    }
  };

  const toggleRetargetingPool = async (poolId: string) => {
    if (!selectedCampaign) return;
    const nextActivated = {
      ...retargetingActivated,
      [poolId]: !retargetingActivated[poolId],
    };
    setRetargetingActivated(nextActivated);

    const pools = (selectedCampaign.retargetingPools || []).map((p) => ({
      ...p,
      activated: Boolean(nextActivated[p.id]),
    }));
    const updated = { ...selectedCampaign, retargetingPools: pools };
    setSelectedCampaign(updated);
    setCampaignList((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    try {
      await saveCampaign(updated);
      setSyncStatus('live');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fade-rise space-y-5 sm:space-y-6">
      <div className="surface-panel p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow-label">Campaigns</p>
            <h2 className="font-display mt-1 text-3xl font-medium text-white">Portfolio</h2>
            <p className="mt-2 text-sm text-slate-400">
              {syncStatus === 'live' ? 'Live' : 'Local'} · filter by outcome, then open a campaign.
            </p>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="primary-button w-full justify-center sm:w-auto">
            <Plus className="h-4 w-4" />
            <span>Create campaign</span>
          </button>
        </div>

        {!selectedCampaign && (
          <p className="mt-6 text-sm text-slate-400">No campaigns yet for this client. Create one to get started.</p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => setFilterObjective('all')}
            className={`rounded-full px-3 py-1.5 text-xs transition ${
              filterObjective === 'all'
                ? 'bg-[color:var(--accent-soft)] text-[color:var(--accent)] ring-1 ring-[color:var(--accent)]/40'
                : 'bg-white/[0.03] text-slate-400 ring-1 ring-white/10'
            }`}
          >
            All ({objectiveSummary.all})
          </button>
          {(['followers', 'lead_generation', 'sales', 'awareness', 'retention'] as CampaignObjective[]).map((objective) => {
            const meta = objectiveMeta[objective];
            const active = filterObjective === objective;
            return (
              <button
                key={objective}
                onClick={() => setFilterObjective(objective)}
                title={meta.description}
                className={`rounded-full px-3 py-1.5 text-xs transition ${
                  active
                    ? 'bg-[color:var(--accent-soft)] text-[color:var(--accent)] ring-1 ring-[color:var(--accent)]/40'
                    : 'bg-white/[0.03] text-slate-400 ring-1 ring-white/10'
                }`}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="surface-panel overflow-hidden">
        <div className="divide-y divide-white/[0.05]">
          {filteredCampaigns.map((camp) => {
            const isSelected = selectedCampaign?.id === camp.id;
            return (
              <div
                key={camp.id}
                onClick={() => {
                  setSelectedCampaign(camp);
                  setFunnelAiOutput(camp.aiNotes || null);
                  const map: Record<string, boolean> = {};
                  (camp.retargetingPools || []).forEach((p) => {
                    map[p.id] = Boolean(p.activated);
                  });
                  setRetargetingActivated(map);
                  setDetailTab('overview');
                }}
                className={`flex cursor-pointer items-center gap-4 px-4 py-3.5 transition sm:px-5 ${
                  isSelected ? 'bg-[color:var(--accent-soft)]' : 'hover:bg-white/[0.02]'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-white">{camp.name}</p>
                    <span className="text-[11px] text-slate-500">{camp.objectiveLabel}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">{camp.primaryGoal}</p>
                </div>
                <p className="shrink-0 text-xs text-slate-400">{camp.currentProgress}%</p>
                <p className="hidden shrink-0 text-xs text-slate-500 sm:block">
                  ${camp.budget.toLocaleString()}
                </p>
                {deletingCampId === camp.id ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCampaign(camp.id);
                    }}
                    className="rounded-lg bg-rose-600 px-2 py-1 text-[11px] text-white"
                  >
                    Confirm
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingCampId(camp.id);
                    }}
                    className="rounded-lg p-2 text-slate-500 hover:text-rose-300"
                    title="Delete Campaign"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedCampaign && (
      <div className="surface-panel p-5 sm:p-6">
        <div className="border-b border-white/[0.06] pb-4">
          <p className="eyebrow-label">Selected</p>
          <h3 className="font-display mt-1 text-2xl font-medium text-white">{selectedCampaign.name}</h3>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">{selectedCampaign.primaryGoal}</p>
          <div className="mt-4 flex gap-1">
            {(['overview', 'funnel', 'retargeting'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setDetailTab(tab)}
                className={`rounded-lg px-3 py-1.5 text-xs capitalize transition ${
                  detailTab === tab
                    ? 'bg-[color:var(--accent-soft)] text-white'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {detailTab === 'overview' && (
          <div className="mt-5 space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="surface-subtle p-4">
                <p className="text-[11px] text-slate-500">Impressions</p>
                <p className="mt-2 text-lg font-semibold text-white">{selectedCampaign.metrics.impressions.toLocaleString()}</p>
              </div>
              <div className="surface-subtle p-4">
                <p className="text-[11px] text-slate-500">Leads</p>
                <p className="mt-2 text-lg font-semibold text-[color:var(--accent)]">{selectedCampaign.metrics.leads.toLocaleString()}</p>
              </div>
              <div className="surface-subtle p-4">
                <p className="text-[11px] text-slate-500">Conversions</p>
                <p className="mt-2 text-lg font-semibold text-white">{selectedCampaign.metrics.conversions.toLocaleString()}</p>
              </div>
              <div className="surface-subtle p-4">
                <p className="text-[11px] text-slate-500">ROAS</p>
                <p className="mt-2 text-lg font-semibold text-white">{selectedCampaign.metrics.roas}x</p>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              {selectedCampaign.startDate} → {selectedCampaign.endDate} ·{' '}
              {selectedCampaign.channels.map((c) => c.replace('_', ' ')).join(', ')}
            </p>
            <button
              onClick={handleGenerateFunnelStrategy}
              disabled={generatingFunnel}
              className="primary-button"
            >
              {generatingFunnel ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              <span>{generatingFunnel ? 'Generating' : 'Run AI strategy'}</span>
            </button>
            {funnelError && (
              <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                {funnelError}
              </div>
            )}
            {funnelAiOutput && (
              <div className="surface-subtle whitespace-pre-line p-4 text-sm leading-7 text-slate-200">
                {funnelAiOutput}
              </div>
            )}
          </div>
        )}

        {detailTab === 'funnel' && (
          <div className="mt-5">
            {selectedCampaign.funnelStages ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {selectedCampaign.funnelStages.map((stage, idx) => (
                  <div key={idx} className="surface-subtle p-4">
                    <p className="text-[11px] text-slate-500">{stage.stageName}</p>
                    <p className="mt-2 text-lg font-semibold text-white">{stage.count.toLocaleString()}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="text-slate-300">{stage.conversionRate}% CVR</span>
                      <span className="text-slate-500">{stage.dropoffRate}% drop</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No funnel stages for this campaign yet.</p>
            )}
          </div>
        )}

        {detailTab === 'retargeting' && (
          <div className="mt-5 space-y-3">
            {selectedCampaign.retargetingPools?.length ? (
              selectedCampaign.retargetingPools.map((pool) => {
                const isActive = retargetingActivated[pool.id];
                return (
                  <div key={pool.id} className="surface-subtle p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-white">{pool.name}</p>
                        <p className="mt-1 text-xs text-slate-400">{pool.triggerEvent}</p>
                      </div>
                      <span className="text-[11px] text-slate-500">{pool.size.toLocaleString()} users</span>
                    </div>
                    <button
                      onClick={() => toggleRetargetingPool(pool.id)}
                      className={`mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
                        isActive ? 'bg-[#d7eef4] text-slate-950' : 'secondary-button'
                      }`}
                    >
                      {isActive ? <CheckCircle2 className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                      <span>{isActive ? 'Active' : 'Activate'}</span>
                    </button>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">No retargeting pools yet.</p>
            )}
          </div>
        )}
      </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Create a new campaign</h3>
            <form onSubmit={handleCreateCampaign} className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-slate-300">Campaign name</label>
                <input
                  type="text"
                  required
                  value={newCampName}
                  onChange={(e) => setNewCampName(e.target.value)}
                  placeholder="e.g. September Webinar Lead Push"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-slate-300">Objective</label>
                  <select
                    value={newCampObjective}
                    onChange={(e) => setNewCampObjective(e.target.value as CampaignObjective)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white"
                  >
                    <option value="followers">Grow Followers</option>
                    <option value="lead_generation">Generate Leads</option>
                    <option value="sales">Drive Sales</option>
                    <option value="awareness">Build Awareness</option>
                    <option value="retention">Retain Warm Leads</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-300">Campaign type</label>
                  <select
                    value={newCampType}
                    onChange={(e) => setNewCampType(e.target.value as CampaignType)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white"
                  >
                    <option value="sales_conversion">Sales conversion</option>
                    <option value="follower_growth">Follower growth</option>
                    <option value="retargeting">Retargeting</option>
                    <option value="lead_generation">Lead generation</option>
                    <option value="brand_awareness">Brand awareness</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-300">Primary goal</label>
                <input
                  type="text"
                  required
                  value={newCampGoal}
                  onChange={(e) => setNewCampGoal(e.target.value)}
                  placeholder="e.g. Generate 200 booked discovery calls in 30 days"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-slate-300">Budget ($)</label>
                  <input
                    type="number"
                    value={newCampBudget}
                    onChange={(e) => setNewCampBudget(Number(e.target.value))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-300">Success KPI</label>
                  <input
                    type="text"
                    value={newCampTarget}
                    onChange={(e) => setNewCampTarget(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="secondary-button"
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  Launch campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
