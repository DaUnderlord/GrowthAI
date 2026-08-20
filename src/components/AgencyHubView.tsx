import React, { useState } from 'react';
import { 
  Building2, 
  Settings, 
  ShieldCheck, 
  Key, 
  Users, 
  CheckCircle2, 
  Plus, 
  Palette, 
  DollarSign, 
  Lock, 
  Globe,
  FileCheck,
  Link2
} from 'lucide-react';
import { ClientProfile, ConnectedPlatform, UserProfile } from '../types';
import { SocialAccountsView } from './SocialAccountsView';

interface AgencyHubProps {
  clients: ClientProfile[];
  onAddClient: (newClient: ClientProfile) => void;
  whiteLabelMode: boolean;
  setWhiteLabelMode: (val: boolean) => void;
  selectedClient: ClientProfile;
  currentUser?: UserProfile;
  onUpdateClientPlatforms?: (clientId: string, platforms: ConnectedPlatform[]) => void;
}

export const AgencyHubView: React.FC<AgencyHubProps> = ({
  clients,
  onAddClient,
  whiteLabelMode,
  setWhiteLabelMode,
  selectedClient,
  currentUser,
  onUpdateClientPlatforms,
}) => {
  const [activeTab, setActiveTab] = useState<'tenants' | 'socials' | 'whitelabel' | 'subscriptions' | 'security'>('tenants');

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

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName) return;

    const initialPlatforms: ConnectedPlatform[] = [
      { id: 'instagram', name: 'Instagram', icon: 'Instagram', connected: Boolean(onboardIgHandle), accountName: onboardIgHandle ? (onboardIgHandle.startsWith('@') ? onboardIgHandle : `@${onboardIgHandle}`) : `@${newClientName.toLowerCase().replace(/\s+/g, '')}`, followers: 25000, growthRate: 12.5, lastSync: 'Just now', healthScore: 92 },
      { id: 'facebook', name: 'Facebook', icon: 'Facebook', connected: Boolean(onboardFbPage), accountName: onboardFbPage || `${newClientName} Page`, followers: 18000, growthRate: 5.2, lastSync: 'Just now', healthScore: 88 },
      { id: 'tiktok', name: 'TikTok', icon: 'Video', connected: Boolean(onboardTiktokHandle), accountName: onboardTiktokHandle ? (onboardTiktokHandle.startsWith('@') ? onboardTiktokHandle : `@${onboardTiktokHandle}`) : `@${newClientName.toLowerCase().replace(/\s+/g, '')}_tiktok`, followers: 45000, growthRate: 28.0, lastSync: 'Just now', healthScore: 95 },
    ];

    const newClientObj: ClientProfile = {
      id: `client-${Date.now()}`,
      name: newClientName,
      industry: newClientIndustry,
      industryLabel: newClientIndustry.toUpperCase(),
      logo: 'https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=150&auto=format&fit=crop&q=80',
      website: `${newClientName.toLowerCase().replace(/\s+/g, '')}.com`,
      tier: 'Agency Growth',
      monthlyBudget: Number(newClientBudget),
      primaryGoal: newClientGoal,
      growthScore: 85,
      viralityScore: 80,
      engagementHealth: 88,
      sentimentScore: 90,
      conversionScore: 82,
      roiMultiplier: 4.5,
      platforms: initialPlatforms,
      nextPaymentDate: '2026-08-30',
      lastPaymentDate: '2026-07-30',
      paymentStatus: 'paid',
      outstandingAmount: 0,
      invoices: [],
      recentGrowthTrends: [
        { month: 'May', reach: 250000, engagement: 22000, leads: 1100, conversions: 220, revenue: 55000 },
        { month: 'Jun', reach: 380000, engagement: 34000, leads: 1800, conversions: 360, revenue: 90000 },
        { month: 'Jul', reach: 520000, engagement: 48000, leads: 2600, conversions: 520, revenue: 130000 },
      ],
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
            Manage agency clients, team roles, white-label branding, API integration vaults, and enterprise GDPR/SOC2 security settings.
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
          { id: 'socials', label: 'Social Accounts Connection', icon: Link2 },
          { id: 'whitelabel', label: 'White-Label Branding', icon: Palette },
          { id: 'subscriptions', label: 'SaaS Billing & Tiers', icon: DollarSign },
          { id: 'security', label: 'GDPR & SOC2 Compliance', icon: ShieldCheck },
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
                <p><span className="text-slate-500">Tier:</span> {c.tier}</p>
                <p><span className="text-slate-500">Ad Budget:</span> ${c.monthlyBudget.toLocaleString()}/mo</p>
                <p><span className="text-slate-500">Connected API Channels:</span> {c.platforms.length} Platforms</p>
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
      {activeTab === 'socials' && (
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

      {/* Tab 2: White Label Branding */}
      {activeTab === 'whitelabel' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 max-w-2xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Palette className="w-4 h-4 text-cyan-400" />
            Agency Custom White-Label Portal Settings
          </h3>
          <p className="text-xs text-slate-400">
            Customize platform portal name, logo, domain CNAME, and client report footers.
          </p>

          <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
            <div>
              <span className="text-xs font-bold text-white block">Enable White-Label Portal Name</span>
              <span className="text-[10px] text-slate-400">Replaces 'GrowthOS AI' with 'AgencyPulse AI' across client UI</span>
            </div>
            <button
              onClick={() => setWhiteLabelMode(!whiteLabelMode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                whiteLabelMode ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {whiteLabelMode ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Custom CNAME Subdomain</label>
              <input
                type="text"
                defaultValue="growth.myagency.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Agency Support Email</label>
              <input
                type="text"
                defaultValue="support@myagency.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Subscriptions */}
      {activeTab === 'subscriptions' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { title: 'Agency Starter', price: '$299', period: '/month', clients: 'Up to 5 Clients', features: ['Growth Intelligence', 'AI Prediction Engine', 'Weekly Email Summaries'] },
            { title: 'Agency Growth', price: '$799', period: '/month', clients: 'Up to 20 Clients', features: ['Full 7-Agent Council', 'Autonomous Reboost Agent', 'Competitor Intelligence Radar'], popular: true },
            { title: 'Enterprise White-Label', price: '$1,999', period: '/month', clients: 'Unlimited Clients', features: ['Custom Domain CNAME', 'Multi-touch Revenue Attribution', 'Dedicated SLA & API Access'] },
          ].map((tier, idx) => (
            <div
              key={idx}
              className={`bg-slate-900 border rounded-2xl p-6 shadow-xl space-y-4 relative ${
                tier.popular ? 'border-indigo-500 shadow-indigo-500/10' : 'border-slate-800'
              }`}
            >
              {tier.popular && (
                <span className="absolute -top-3 right-6 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-600 text-white">
                  Most Popular
                </span>
              )}
              <h3 className="text-base font-bold text-white">{tier.title}</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white">{tier.price}</span>
                <span className="text-xs text-slate-400">{tier.period}</span>
              </div>
              <span className="text-xs text-cyan-300 font-semibold block">{tier.clients}</span>
              <ul className="space-y-2 text-xs text-slate-300 pt-2 border-t border-slate-800">
                {tier.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Tab 4: Security & Compliance */}
      {activeTab === 'security' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            GDPR, SOC2 Type II & Official API Compliance Audit
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
              <span className="font-bold text-white block">Official Meta & TikTok API Compliance</span>
              <p className="text-slate-400">Zero scraping or fake engagement. All data fetched strictly via OAuth user permissions.</p>
            </div>
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
              <span className="font-bold text-white block">AES-256 OAuth Token Encryption</span>
              <p className="text-slate-400">Social refresh tokens encrypted using KMS envelope encryption at rest.</p>
            </div>
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
              <span className="font-bold text-white block">GDPR Right-to-be-Forgotten</span>
              <p className="text-slate-400">One-click data deletion policy removing client historical telemetry within 24 hours.</p>
            </div>
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
              <span className="font-bold text-white block">Multi-Tenant RBAC Isolation</span>
              <p className="text-slate-400">Strict tenant isolation guaranteeing client dataset segregation.</p>
            </div>
          </div>
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
