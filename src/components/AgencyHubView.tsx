import React, { useState } from 'react';
import { 
  Building2, 
  Plus, 
  Link2
} from 'lucide-react';
import { ClientProfile, ConnectedPlatform, UserProfile } from '../types';
import { SocialAccountsView } from './SocialAccountsView';

interface AgencyHubProps {
  clients: ClientProfile[];
  onAddClient: (newClient: ClientProfile) => void;
  selectedClient: ClientProfile | null;
  currentUser?: UserProfile;
  onUpdateClientPlatforms?: (clientId: string, platforms: ConnectedPlatform[]) => void;
}

export const AgencyHubView: React.FC<AgencyHubProps> = ({
  clients,
  onAddClient,
  selectedClient,
  currentUser,
  onUpdateClientPlatforms,
}) => {
  const [activeTab, setActiveTab] = useState<'tenants' | 'socials'>('tenants');

  // Client Onboarding Modal State
  const [showModal, setShowModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientIndustry, setNewClientIndustry] = useState<any>('fmcg');
  const [newClientBudget, setNewClientBudget] = useState(15000);
  const [newClientGoal, setNewClientGoal] = useState('Scale organic reach & lead conversions');
  
  // Onboarding Social Accounts State
  const [onboardIgHandle, setOnboardIgHandle] = useState('');
  const [onboardTiktokHandle, setOnboardTiktokHandle] = useState('');
  const [onboardFbPage, setOnboardFbPage] = useState('');

  const initialFollowersForHandle = (_handle: string) => 0;

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName) return;

    const initialPlatforms: ConnectedPlatform[] = [
      { id: 'instagram', name: 'Instagram', icon: 'Instagram', connected: Boolean(onboardIgHandle), accountName: onboardIgHandle ? (onboardIgHandle.startsWith('@') ? onboardIgHandle : `@${onboardIgHandle}`) : `@${newClientName.toLowerCase().replace(/\s+/g, '')}`, followers: onboardIgHandle ? initialFollowersForHandle(onboardIgHandle) : 0, growthRate: 0, lastSync: onboardIgHandle ? 'Pending sync' : 'Not connected', healthScore: onboardIgHandle ? 80 : 0 },
      { id: 'facebook', name: 'Facebook', icon: 'Facebook', connected: Boolean(onboardFbPage), accountName: onboardFbPage || `${newClientName} Page`, followers: onboardFbPage ? initialFollowersForHandle(onboardFbPage) : 0, growthRate: 0, lastSync: onboardFbPage ? 'Pending sync' : 'Not connected', healthScore: onboardFbPage ? 80 : 0 },
      { id: 'tiktok', name: 'TikTok', icon: 'Video', connected: Boolean(onboardTiktokHandle), accountName: onboardTiktokHandle ? (onboardTiktokHandle.startsWith('@') ? onboardTiktokHandle : `@${onboardTiktokHandle}`) : `@${newClientName.toLowerCase().replace(/\s+/g, '')}_tiktok`, followers: onboardTiktokHandle ? initialFollowersForHandle(onboardTiktokHandle) : 0, growthRate: 0, lastSync: onboardTiktokHandle ? 'Pending sync' : 'Not connected', healthScore: onboardTiktokHandle ? 80 : 0 },
    ];

    const newClientObj: ClientProfile = {
      id: `client-${Date.now()}`,
      name: newClientName,
      industry: newClientIndustry,
      industryLabel: newClientIndustry.toUpperCase(),
      logo: 'https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=150&auto=format&fit=crop&q=80',
      website: `${newClientName.toLowerCase().replace(/\s+/g, '')}.com`,
      tier: 'Starter',
      monthlyBudget: Number(newClientBudget),
      primaryGoal: newClientGoal,
      growthScore: 0,
      viralityScore: 0,
      engagementHealth: 0,
      sentimentScore: 0,
      conversionScore: 0,
      roiMultiplier: 0,
      platforms: initialPlatforms,
      nextPaymentDate: '',
      lastPaymentDate: '',
      paymentStatus: 'outstanding',
      outstandingAmount: 0,
      invoices: [],
      recentGrowthTrends: [],
    };

    onAddClient(newClientObj);
    setShowModal(false);
    setNewClientName('');
    setOnboardIgHandle('');
    setOnboardTiktokHandle('');
    setOnboardFbPage('');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-bold text-white">Multi-Tenant Agency Management Hub</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Manage client brands and connected social accounts for this workspace.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Onboard New Client</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs overflow-x-auto scrollbar-none">
        {[
          { id: 'tenants', label: 'Client Accounts', icon: Building2 },
          { id: 'socials', label: 'Social Accounts', icon: Link2 },
        ].map((t) => {
          const IconComp = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <IconComp className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Client Accounts */}
      {activeTab === 'tenants' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((c) => (
            <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-3">
                <img src={c.logo} alt={c.name} className="w-12 h-12 rounded-xl object-cover border border-slate-700" />
                <div>
                  <h3 className="text-sm font-bold text-white">{c.name}</h3>
                  <p className="text-xs text-indigo-300">{c.industryLabel}</p>
                </div>
              </div>
              <div className="text-xs text-slate-300 space-y-1">
                <p><span className="text-slate-500">Ad Budget:</span> ${c.monthlyBudget.toLocaleString()}/mo</p>
                <p><span className="text-slate-500">Connected channels:</span> {c.platforms.filter((p) => p.connected).length}</p>
              </div>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-emerald-400 font-bold">{c.growthScore} Growth Score</span>
                <button
                  onClick={() => setActiveTab('socials')}
                  className="text-cyan-400 hover:underline font-semibold text-[11px]"
                >
                  Manage Social Accounts →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Social Accounts Connection */}
      {activeTab === 'socials' && selectedClient && (
        <SocialAccountsView
          client={selectedClient}
          currentUser={currentUser}
          onUpdatePlatforms={(updatedPlatforms) => {
            if (onUpdateClientPlatforms) {
              onUpdateClientPlatforms(selectedClient.id, updatedPlatforms);
            }
          }}
        />
      )}
      {activeTab === 'socials' && !selectedClient && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-400">
          Add a brand in this hub first, then connect social accounts.
        </div>
      )}

      {/* Onboarding Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white">Onboard New Agency Client</h3>
            <form onSubmit={handleCreateClient} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Client Brand / Company Name</label>
                <input
                  type="text"
                  required
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="e.g. Zenith Tech Solutions"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Industry Vertical</label>
                <select
                  value={newClientIndustry}
                  onChange={(e) => setNewClientIndustry(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="fmcg">FMCG & Consumer Goods</option>
                  <option value="healthcare">Healthcare & Wellness</option>
                  <option value="realestate">Real Estate & Property</option>
                  <option value="education">Education & EdTech</option>
                  <option value="politics">Politics & Public Strategy</option>
                  <option value="hospitality">Hospitality & Food</option>
                  <option value="sme">SME & E-commerce</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Monthly Marketing Budget ($)</label>
                <input
                  type="number"
                  value={newClientBudget}
                  onChange={(e) => setNewClientBudget(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Primary Growth Objective</label>
                <input
                  type="text"
                  value={newClientGoal}
                  onChange={(e) => setNewClientGoal(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              {/* Onboarding Social Accounts Section */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <span className="font-bold text-cyan-400 block text-xs">Connect Social Accounts (Onboarding)</span>
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">Instagram Handle</label>
                  <input
                    type="text"
                    value={onboardIgHandle}
                    onChange={(e) => setOnboardIgHandle(e.target.value)}
                    placeholder="e.g. @zenith_tech"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">TikTok Handle</label>
                  <input
                    type="text"
                    value={onboardTiktokHandle}
                    onChange={(e) => setOnboardTiktokHandle(e.target.value)}
                    placeholder="e.g. @zenith_official"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">Facebook Page Name</label>
                  <input
                    type="text"
                    value={onboardFbPage}
                    onChange={(e) => setOnboardFbPage(e.target.value)}
                    placeholder="e.g. Zenith Tech Solutions Page"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 shadow-lg shadow-indigo-600/30"
                >
                  Create Client & Sync Accounts
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
