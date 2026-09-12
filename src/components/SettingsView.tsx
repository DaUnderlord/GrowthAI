import React, { useState } from 'react';
import {
  Building2,
  CheckCircle2,
  DollarSign,
  Lock,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { ClientProfile, CurrencyCode, UserProfile } from '../types';
import { CURRENCIES } from '../utils/currency';
import { resetPasswordForEmail, saveWorkspacePreferences, supabase } from '../lib/supabase';
import { authFetch } from '../lib/authFetch';
import { IANA_TIMEZONES } from '../lib/liveApi';
import { MetaOnboarding } from './MetaOnboarding';
import { ProviderOnboarding } from './ProviderOnboarding';
import { useWorkspaceLocale } from '../lib/WorkspaceLocale';

interface SettingsViewProps {
  currentUser: UserProfile;
  selectedClient?: ClientProfile | null;
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  whiteLabelMode: boolean;
  setWhiteLabelMode: (val: boolean) => void;
  onUserUpdated?: (user: UserProfile) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  selectedClient,
  currency,
  setCurrency,
  whiteLabelMode,
  setWhiteLabelMode,
  onUserUpdated,
}) => {
  const { t } = useWorkspaceLocale();
  const prefs = currentUser.preferences || {};
  const [activeTab, setActiveTab] = useState<'general' | 'preferences' | 'security' | 'integrations' | 'domain'>('general');
  const [mfaQr, setMfaQr] = useState<string | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaStatus, setMfaStatus] = useState<string | null>(null);
  const [domain, setDomain] = useState('');
  const [domainMsg, setDomainMsg] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState(currentUser.companyName || 'GrowthOS Agency');
  const [website, setWebsite] = useState(currentUser.website || prefs.website || 'https://growthos.ai');
  const [language, setLanguage] = useState(prefs.language || 'en');
  const [timeZone, setTimeZone] = useState(prefs.timeZone || 'Africa/Lagos');
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const tabs = [
    { id: 'general' as const, label: t('tab_general'), icon: Building2 },
    { id: 'preferences' as const, label: t('tab_preferences'), icon: DollarSign },
    { id: 'security' as const, label: t('tab_security'), icon: Lock },
    { id: 'integrations' as const, label: t('tab_integrations'), icon: Zap },
    { id: 'domain' as const, label: t('tab_domain'), icon: Building2 },
  ];

  const handleSaveSettings = async () => {
    setSaveError(null);
    try {
      const updated = await saveWorkspacePreferences(currentUser.id, {
        companyName,
        website,
        preferences: {
          website,
          language,
          timeZone,
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
            <p className="eyebrow-label">{t('settings')}</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">{t('workspacePreferences')}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{t('settingsIntro')}</p>
          </div>
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto">
            <button onClick={handleSaveSettings} className="primary-button w-full justify-center sm:w-auto">
              {savedNotice ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Zap className="h-4 w-4" />}
              <span>{savedNotice ? t('saved') : t('saveChanges')}</span>
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
                  <p className="mt-1 text-[11px] text-slate-400">Show AgencyPulse branding instead of GrowthOS</p>
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
              <label className="mb-1 block text-xs text-slate-400">{t('language')}</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs text-white"
              >
                <option value="en">English (US)</option>
                <option value="fr">French (Français)</option>
                <option value="es">Spanish (Español)</option>
                <option value="de">German (Deutsch)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Time zone</label>
              <select
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs text-white"
              >
                {IANA_TIMEZONES.map((z) => (
                  <option key={z.value} value={z.value}>{z.label}</option>
                ))}
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
              <h3 className="text-sm font-semibold text-white">Session</h3>
            </div>
            <div className="surface-subtle space-y-1 p-4 text-[11px] text-slate-400">
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

      {activeTab === 'security' && (
        <div className="surface-panel mt-4 space-y-3 p-5">
          <h3 className="text-sm font-semibold text-white">Authenticator app (TOTP)</h3>
          <p className="text-xs text-slate-400">Uses Supabase MFA. Scan the QR, then confirm the 6-digit code.</p>
          <button
            type="button"
            className="secondary-button"
            onClick={async () => {
              setMfaStatus(null);
              const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
              if (error) {
                setMfaStatus(error.message);
                return;
              }
              setMfaFactorId(data.id);
              setMfaQr(data.totp.qr_code);
            }}
          >
            Start 2FA enrollment
          </button>
          {mfaQr && <img src={mfaQr} alt="MFA QR" className="h-40 w-40 rounded-xl bg-white p-2" />}
          {mfaFactorId && (
            <div className="flex gap-2">
              <input
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="123456"
                className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
              />
              <button
                type="button"
                className="primary-button"
                onClick={async () => {
                  const challenge = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
                  if (challenge.error) {
                    setMfaStatus(challenge.error.message);
                    return;
                  }
                  const verified = await supabase.auth.mfa.verify({
                    factorId: mfaFactorId,
                    challengeId: challenge.data.id,
                    code: mfaCode,
                  });
                  setMfaStatus(verified.error ? verified.error.message : 'Two-factor authentication is on.');
                }}
              >
                Confirm
              </button>
            </div>
          )}
          {mfaStatus && <p className="text-xs text-cyan-200">{mfaStatus}</p>}
        </div>
      )}

      {activeTab === 'integrations' && (
        <div className="space-y-4">
          <MetaOnboarding client={selectedClient} />
          <ProviderOnboarding family="google" client={selectedClient} />
          <ProviderOnboarding family="tiktok" client={selectedClient} />
          <ProviderOnboarding family="linkedin" client={selectedClient} />
        </div>
      )}

      {activeTab === 'domain' && (
        <div className="surface-panel space-y-3 p-5">
          <h3 className="text-sm font-semibold text-white">White-label domain</h3>
          <p className="text-xs text-slate-400">
            Point a CNAME to cname.vercel-dns.com and add a TXT record. Optional VERCEL_TOKEN adds the domain on Vercel.
          </p>
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="app.youragency.com"
            className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="secondary-button"
              onClick={async () => {
                const res = await authFetch('/api/org/domain', { method: 'POST', body: JSON.stringify({ domain }) });
                const data = await res.json();
                setDomainMsg(data.error || `Add TXT ${data.txtRecord?.value} on ${data.domain}`);
              }}
            >
              Save domain
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={async () => {
                const res = await authFetch('/api/org/domain/verify', { method: 'POST', body: JSON.stringify({}) });
                const data = await res.json();
                setDomainMsg(data.verified ? 'Domain verified.' : data.error || 'TXT record not found yet.');
              }}
            >
              Verify DNS
            </button>
          </div>
          {domainMsg && <p className="text-xs text-cyan-200">{domainMsg}</p>}
        </div>
      )}
    </div>
  );
};
