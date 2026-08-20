import React, { useState } from 'react';
import {
  Bell,
  Building2,
  CheckCircle2,
  Cpu,
  DollarSign,
  FileText,
  Key,
  Layers,
  Lock,
  ShieldCheck,
  Sliders,
  Sparkles,
  Zap,
} from 'lucide-react';
import { CurrencyCode, UserProfile } from '../types';
import { CURRENCIES } from '../utils/currency';
import { resetPasswordForEmail, saveWorkspacePreferences } from '../lib/supabase';

interface SettingsViewProps {
  currentUser: UserProfile;
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  whiteLabelMode: boolean;
  setWhiteLabelMode: (val: boolean) => void;
  mode: 'platform' | 'blueprint';
  setMode: (mode: 'platform' | 'blueprint') => void;
  onUserUpdated?: (user: UserProfile) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  currency,
  setCurrency,
  whiteLabelMode,
  setWhiteLabelMode,
  mode,
  setMode,
  onUserUpdated,
}) => {
  const prefs = currentUser.preferences || {};
  const [activeTab, setActiveTab] = useState<'general' | 'preferences' | 'security' | 'system'>('general');
  const [companyName, setCompanyName] = useState(currentUser.companyName || 'GrowthOS Agency');
  const [website, setWebsite] = useState(currentUser.website || prefs.website || 'https://growthos.ai');
  const [emailAlerts, setEmailAlerts] = useState(prefs.emailAlerts ?? true);
  const [weeklyDigest, setWeeklyDigest] = useState(prefs.weeklyDigest ?? true);
  const [language, setLanguage] = useState(prefs.language || 'English (US)');
  const [timeZone, setTimeZone] = useState(prefs.timeZone || 'UTC+0 (WAT / London)');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(prefs.twoFactorEnabled ?? false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [aiAutopilot, setAiAutopilot] = useState(prefs.aiAutopilot ?? true);
  const [savedNotice, setSavedNotice] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isSuperAdmin = currentUser.role === 'super_admin' || currentUser.role === 'admin';

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Building2 },
    { id: 'preferences' as const, label: 'Preferences', icon: DollarSign },
    { id: 'security' as const, label: 'Security', icon: Lock },
    ...(isSuperAdmin ? [{ id: 'system' as const, label: 'System', icon: Cpu }] : []),
  ];

  const handleSaveSettings = async () => {
    setSaveError(null);
    try {
      const updated = await saveWorkspacePreferences(currentUser.id, {
        companyName,
        website,
        preferences: {
          website,
          emailAlerts,
          weeklyDigest,
          language,
          timeZone,
          twoFactorEnabled,
          aiAutopilot,
          currency,
          whiteLabelMode,
        },
      });
      onUserUpdated?.(updated);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    } catch (err: any) {
      setSaveError(err.message || 'Could not save settings.');
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="surface-panel p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow-label">Settings</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Workspace preferences</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Keep settings simple: brand, currency, security, and a few admin controls when needed.
            </p>
          </div>
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto">
            <button onClick={handleSaveSettings} className="primary-button w-full justify-center sm:w-auto">
              {savedNotice ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Zap className="h-4 w-4" />}
              <span>{savedNotice ? 'Saved' : 'Save changes'}</span>
            </button>
            {saveError && <p className="text-center text-[11px] text-rose-300">{saveError}</p>}
          </div>
        </div>
      </div>

      <div className="-mx-1 overflow-x-auto px-1 scrollbar-none">
        <div className="flex min-w-max gap-2 border-b border-white/10 pb-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-white text-slate-950'
                    : 'border border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-slate-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'general' && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="surface-panel space-y-4 p-5">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <Building2 className="h-4 w-4 text-indigo-300" />
              <h3 className="text-sm font-semibold text-white">Company</h3>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block text-slate-400">Agency name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">Website</label>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white"
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div>
                  <p className="font-medium text-white">White-label mode</p>
                  <p className="mt-1 text-[11px] text-slate-400">Show AgencyPulse AI branding instead of GrowthOS</p>
                </div>
                <button
                  onClick={() => setWhiteLabelMode(!whiteLabelMode)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                    whiteLabelMode ? 'bg-indigo-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition ${
                      whiteLabelMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="surface-panel space-y-4 p-5">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <Bell className="h-4 w-4 text-cyan-300" />
              <h3 className="text-sm font-semibold text-white">Notifications</h3>
            </div>
            <div className="space-y-3 text-xs">
              {[
                {
                  title: 'Email alerts',
                  helper: 'Get notified when campaigns hit key milestones',
                  value: emailAlerts,
                  onChange: setEmailAlerts,
                },
                {
                  title: 'Weekly digest',
                  helper: 'A Monday summary of performance and next actions',
                  value: weeklyDigest,
                  onChange: setWeeklyDigest,
                },
              ].map((item) => (
                <label
                  key={item.title}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div>
                    <p className="font-medium text-white">{item.title}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{item.helper}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={item.value}
                    onChange={(e) => item.onChange(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-indigo-500"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'preferences' && (
        <div className="surface-panel space-y-5 p-5 sm:p-6">
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <DollarSign className="h-4 w-4 text-emerald-300" />
            <h3 className="text-sm font-semibold text-white">Currency & localization</h3>
          </div>

          <div>
            <p className="text-xs text-slate-400">
              Choose the currency used for budgets, revenue, and reporting across the workspace.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.values(CURRENCIES).map((c) => {
                const isSelected = currency === c.code;
                return (
                  <button
                    key={c.code}
                    onClick={() => setCurrency(c.code)}
                    className={`flex items-center justify-between rounded-3xl border p-4 text-left transition ${
                      isSelected
                        ? 'border-emerald-400/40 bg-emerald-500/10'
                        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300">
                        {c.symbol}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{c.code}</p>
                        <p className="text-[11px] text-slate-400">{c.name}</p>
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 className="h-5 w-5 text-emerald-300" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs text-white"
              >
                <option>English (US)</option>
                <option>French (Français)</option>
                <option>Spanish (Español)</option>
                <option>German (Deutsch)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Time zone</label>
              <select
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs text-white"
              >
                <option>UTC+0 (WAT / London)</option>
                <option>UTC-5 (EST / New York)</option>
                <option>UTC-8 (PST / San Francisco)</option>
                <option>UTC+1 (CET / Paris)</option>
                <option>UTC+4 (GST / Dubai)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="surface-panel space-y-4 p-5">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <Lock className="h-4 w-4 text-indigo-300" />
              <h3 className="text-sm font-semibold text-white">Account access</h3>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block text-slate-400">Signed-in account</label>
                <input
                  type="text"
                  disabled
                  value={currentUser.email}
                  className="w-full cursor-not-allowed rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-slate-400"
                />
              </div>
              <button
                onClick={async () => {
                  try {
                    await resetPasswordForEmail(currentUser.email);
                    setPasswordSuccess(`Password reset link sent to ${currentUser.email}`);
                  } catch (err: any) {
                    setPasswordSuccess(err.message || 'Could not send reset email.');
                  }
                }}
                className="secondary-button w-full justify-center"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Send password reset</span>
              </button>
              {passwordSuccess && <p className="text-center text-[11px] text-emerald-300">{passwordSuccess}</p>}
              {saveError && <p className="text-center text-[11px] text-rose-300">{saveError}</p>}
            </div>
          </div>

          <div className="surface-panel space-y-4 p-5">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              <h3 className="text-sm font-semibold text-white">Two-factor auth</h3>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs">
              <div>
                <p className="font-medium text-white">Require authenticator code</p>
                <p className="mt-1 text-[11px] text-slate-400">Adds an extra check before account access</p>
              </div>
              <button
                onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                  twoFactorEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition ${
                    twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div className="surface-subtle space-y-1 p-4 text-[11px] text-slate-400">
              <p className="font-medium text-slate-200">Session</p>
              <p>
                User ID: <span className="font-mono text-cyan-300">{currentUser.id}</span>
              </p>
              <p>
                Role: <span className="uppercase text-indigo-200">{currentUser.role}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'system' && isSuperAdmin && (
        <div className="surface-panel space-y-5 p-5 sm:p-6">
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <Cpu className="h-4 w-4 text-cyan-300" />
            <h3 className="text-sm font-semibold text-white">Admin system controls</h3>
          </div>

          <div className="surface-subtle space-y-3 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Workspace mode</p>
                <p className="mt-1 text-xs text-slate-400">Switch between the live product and architecture docs.</p>
              </div>
              <span className="w-fit rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold text-cyan-200">
                Admin only
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => setMode('platform')}
                className={`flex items-center justify-between rounded-3xl border p-4 text-left transition ${
                  mode === 'platform'
                    ? 'border-indigo-400/40 bg-indigo-500/10'
                    : 'border-white/10 bg-slate-950/40 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Layers className="h-4 w-4 text-indigo-300" />
                  <div>
                    <p className="text-sm font-medium text-white">Live workspace</p>
                    <p className="text-[11px] text-slate-400">Standard product views</p>
                  </div>
                </div>
                {mode === 'platform' && <CheckCircle2 className="h-4 w-4 text-indigo-300" />}
              </button>
              <button
                onClick={() => setMode('blueprint')}
                className={`flex items-center justify-between rounded-3xl border p-4 text-left transition ${
                  mode === 'blueprint'
                    ? 'border-cyan-400/40 bg-cyan-500/10'
                    : 'border-white/10 bg-slate-950/40 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-cyan-300" />
                  <div>
                    <p className="text-sm font-medium text-white">Blueprint</p>
                    <p className="text-[11px] text-slate-400">Architecture documentation</p>
                  </div>
                </div>
                {mode === 'blueprint' && <CheckCircle2 className="h-4 w-4 text-cyan-300" />}
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="surface-subtle space-y-3 p-4 text-xs">
              <h4 className="flex items-center gap-2 font-medium text-white">
                <Sparkles className="h-4 w-4 text-indigo-300" />
                AI autopilot
              </h4>
              <label className="flex items-center justify-between gap-3 text-slate-400">
                <span>Enable autonomous optimization suggestions</span>
                <input
                  type="checkbox"
                  checked={aiAutopilot}
                  onChange={(e) => setAiAutopilot(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-indigo-500"
                />
              </label>
            </div>
            <div className="surface-subtle space-y-3 p-4 text-xs">
              <h4 className="flex items-center gap-2 font-medium text-white">
                <Key className="h-4 w-4 text-cyan-300" />
                Supabase
              </h4>
              <div className="flex items-center justify-between text-slate-400">
                <span>Auth + Postgres database</span>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  Connected
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
