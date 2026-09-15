import React, { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, Wifi } from 'lucide-react';
import { ClientProfile } from '../types';
import { authFetch } from '../lib/authFetch';
import { readJsonOrThrow } from '../lib/httpJson';
import { navigateView } from '../lib/liveApi';
import { useWorkspaceLocale } from '../lib/WorkspaceLocale';

export type ProviderFamily = 'meta' | 'google' | 'tiktok' | 'linkedin';

const GUIDES: Record<
  ProviderFamily,
  {
    titleKey: string;
    docs: string;
    docsLabel: string;
    idLabel: string;
    secretLabel: string;
    extra?: Array<{ key: 'developerToken' | 'customerId'; label: string }>;
    products: string[];
    connect: Array<{ platform: string; label: string }>;
  }
> = {
  meta: {
    titleKey: 'connectMeta',
    docs: 'https://developers.facebook.com/apps',
    docsLabel: 'Meta',
    idLabel: 'Meta App ID',
    secretLabel: 'App Secret',
    products: [
      'Instagram',
      'Facebook Pages',
      'WhatsApp',
      'Ads',
      'instagram_content_publish',
      'pages_manage_posts',
    ],
    connect: [
      { platform: 'instagram', label: 'Instagram' },
      { platform: 'facebook', label: 'Facebook Page' },
      { platform: 'meta_ads', label: 'Meta Ads' },
    ],
  },
  google: {
    titleKey: 'connectGoogle',
    docs: 'https://console.cloud.google.com/apis/credentials',
    docsLabel: 'Google Cloud Console',
    idLabel: 'OAuth Client ID',
    secretLabel: 'Client Secret',
    extra: [
      { key: 'developerToken', label: 'Google Ads developer token (required for Ads sync)' },
      { key: 'customerId', label: 'Google Ads customer ID (auto-discovered if empty)' },
    ],
    products: ['YouTube Data API', 'Google Analytics Data API', 'Google Ads API'],
    connect: [
      { platform: 'youtube', label: 'YouTube' },
      { platform: 'google_analytics', label: 'GA4' },
      { platform: 'google_ads', label: 'Google Ads' },
    ],
  },
  tiktok: {
    titleKey: 'connectTiktok',
    docs: 'https://developers.tiktok.com/apps',
    docsLabel: 'TikTok for Developers',
    idLabel: 'Client Key',
    secretLabel: 'Client Secret',
    products: ['Login Kit', 'user.info.stats', 'video.list'],
    connect: [{ platform: 'tiktok', label: 'TikTok' }],
  },
  linkedin: {
    titleKey: 'connectLinkedin',
    docs: 'https://www.linkedin.com/developers/apps',
    docsLabel: 'LinkedIn Developers',
    idLabel: 'Client ID',
    secretLabel: 'Client Secret',
    products: ['Sign In with LinkedIn', 'Community Management / Organization'],
    connect: [{ platform: 'linkedin', label: 'LinkedIn Page' }],
  },
};

export function ProviderOnboarding({
  family,
  client,
  compact,
  onStatus,
}: {
  family: ProviderFamily;
  client?: ClientProfile | null;
  compact?: boolean;
  onStatus?: (status: { configured: boolean; appIdValid: boolean }) => void;
}) {
  const { t } = useWorkspaceLocale();
  const guide = GUIDES[family];
  const [step, setStep] = useState(1);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [developerToken, setDeveloperToken] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [configured, setConfigured] = useState(false);
  const [redirectUri, setRedirectUri] = useState(`${window.location.origin}/auth/callback`);
  const [verifyToken, setVerifyToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await authFetch('/api/org/providers');
    const data = await readJsonOrThrow<{
      success?: boolean;
      families?: Record<string, { configured?: boolean; verifyToken?: string; appIdValid?: boolean }>;
    }>(res);
    if (!data.success) return;
    setRedirectUri(`${window.location.origin}/auth/callback`);
    const familyStatus = data.families?.[family];
    const appIdValid = familyStatus?.appIdValid !== false;
    onStatus?.({
      configured: Boolean(familyStatus?.configured),
      appIdValid: Boolean(familyStatus?.configured) && appIdValid,
    });
    if (familyStatus?.configured && family === 'meta' && familyStatus.appIdValid === false) {
      setConfigured(false);
      setStep(2);
      setError('Saved Meta App ID is not the numeric ID from developers.facebook.com/apps. Paste the App ID (numbers only), not an Instagram handle.');
      return;
    }
    if (familyStatus?.configured) {
      setConfigured(true);
      setStep(3);
    }
    if (family === 'meta' && familyStatus?.verifyToken) setVerifyToken(familyStatus.verifyToken);
  };

  useEffect(() => {
    void load().catch(() => undefined);
  }, [family]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'OAUTH_AUTH_ERROR') setError(event.data.error || t('oauthFailed'));
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setError(null);
        void load().catch(() => undefined);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [family]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch('/api/org/providers', {
        method: 'POST',
        body: JSON.stringify({
          family,
          clientId,
          clientSecret,
          developerToken: family === 'google' ? developerToken : undefined,
          customerId: family === 'google' ? customerId : undefined,
        }),
      });
      const data = await readJsonOrThrow<{ success?: boolean; error?: string }>(res);
      if (!data.success) throw new Error(data.error);
      setConfigured(true);
      setStep(3);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const connectPlatform = async (platform: string) => {
    if (!client?.id) {
      setError(t('selectBrandFirst'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      const res = await authFetch(
        `/api/auth/${platform}/url?clientId=${encodeURIComponent(client.id)}&redirectUri=${encodeURIComponent(redirectUri)}`
      );
      const data = await readJsonOrThrow<{ url?: string; error?: string }>(res);
      if (!data.url) throw new Error(data.error || t('couldNotStartLogin'));
      window.open(data.url, `${family}_${platform}`, 'width=600,height=720');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`space-y-4 ${compact ? '' : 'surface-panel p-5 sm:p-6'}`}>
      <div>
        <p className="eyebrow-label">{t('yourAppCredentials')}</p>
        <h3 className="mt-1 text-lg font-semibold text-white">{t(guide.titleKey)}</h3>
        <p className="mt-2 text-sm text-slate-400">{t('bringYourOwnApp')}</p>
      </div>

      <div className="flex gap-2 text-[11px] text-slate-400">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`rounded-full px-2 py-1 ${step === n ? 'bg-cyan-500/15 text-cyan-200' : 'bg-white/5'}`}>
            {t('step')} {n}
          </span>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-3 text-sm text-slate-300">
          {family === 'meta' ? (
            <div className="space-y-2 text-xs text-slate-400">
              <p className="font-semibold text-slate-200">{t('metaCredentialStepsTitle')}</p>
              <ol className="list-decimal space-y-2 pl-5">
                <li>
                  {t('metaCredentialStep1')}{' '}
                  <a className="text-cyan-300 underline" href={guide.docs} target="_blank" rel="noreferrer">
                    developers.facebook.com/apps
                  </a>
                </li>
                <li>{t('metaCredentialStep2')}</li>
                <li>{t('metaCredentialStep3')}</li>
                <li>
                  {t('metaCredentialStep4')}
                  <code className="mt-1 block break-all rounded-lg bg-slate-950 px-2 py-1 text-cyan-200">{redirectUri}</code>
                </li>
                <li>{t('metaCredentialStep5')}</li>
              </ol>
            </div>
          ) : (
            <ol className="list-decimal space-y-2 pl-5 text-xs text-slate-400">
              <li>
                {t('openProviderDashboard')}{' '}
                <a className="text-cyan-300 underline" href={guide.docs} target="_blank" rel="noreferrer">
                  {guide.docsLabel}
                </a>
              </li>
              <li>
                {t('enableProducts')}: {guide.products.join(', ')}
              </li>
              <li>
                {t('addRedirectUrl')}
                <code className="mt-1 block break-all rounded-lg bg-slate-950 px-2 py-1 text-cyan-200">{redirectUri}</code>
              </li>
              <li>{t('copyClientIdSecret')}</li>
            </ol>
          )}
          <button type="button" className="primary-button" onClick={() => setStep(2)}>
            {t('iHaveCredentials')}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          {family === 'meta' && (
            <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-100">
              App ID must be digits only from Meta Settings → Basic. Do not paste an Instagram @handle or Page name.
            </p>
          )}
          <label className="block text-xs text-slate-400">
            {guide.idLabel}
            <input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder={family === 'meta' ? 'Numbers only, e.g. 123456789012345' : ''}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-slate-400">
            {guide.secretLabel}
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </label>
          {family === 'google' && (
            <>
              <label className="block text-xs text-slate-400">
                {t('googleAdsDevToken')}
                <input
                  value={developerToken}
                  onChange={(e) => setDeveloperToken(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-xs text-slate-400">
                {t('googleAdsCustomerId')}
                <input
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </label>
            </>
          )}
          <button type="button" className="primary-button" disabled={busy || !clientId || !clientSecret} onClick={() => void save()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('saveAndContinue')}
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3 text-sm">
          {configured && (
            <p className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="h-4 w-4" /> {t('appSavedForWorkspace')}
            </p>
          )}
          {verifyToken && (
            <p className="text-xs text-slate-400">
              {t('verifyToken')}: <code className="text-cyan-200">{verifyToken}</code>
            </p>
          )}
          <button type="button" className="text-xs text-cyan-300 underline" onClick={() => setStep(2)}>
            Change App ID / secret
          </button>
          <div className="flex flex-wrap gap-2">
            {guide.connect.map((item) => (
              <button key={item.platform} type="button" className="secondary-button" disabled={busy} onClick={() => void connectPlatform(item.platform)}>
                <Wifi className="h-4 w-4" /> {item.label}
              </button>
            ))}
            {family === 'meta' && (
              <button type="button" className="secondary-button" onClick={() => navigateView('whatsapp')}>
                <Wifi className="h-4 w-4" /> WhatsApp
              </button>
            )}
          </div>
          <a className="inline-flex items-center gap-1 text-xs text-cyan-300" href={guide.docs} target="_blank" rel="noreferrer">
            {t('openProviderDashboard')} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {error && <p className="text-xs text-rose-300">{error}</p>}
    </div>
  );
}
