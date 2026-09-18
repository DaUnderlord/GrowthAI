import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  Plus, 
  CheckCircle2, 
  RefreshCw, 
  Check, 
  Sparkles, 
  Link2, 
  ShieldCheck, 
  Trash2, 
  Zap,
  BarChart2,
  Lock,
  ExternalLink
} from 'lucide-react';
import { ClientProfile, ConnectedPlatform, PlatformType, UserProfile } from '../types';
import { authFetch } from '../lib/authFetch';
import { readJsonOrThrow } from '../lib/httpJson';
import { connectionsToPlatforms, oauthRedirectUri } from '../lib/liveApi';
import { MetaOnboarding } from './MetaOnboarding';
import { ProviderOnboarding, type ProviderFamily } from './ProviderOnboarding';
import { ConnectAccountsPrompt } from './ConnectAccountsPrompt';

interface SocialAccountsViewProps {
  client: ClientProfile;
  currentUser?: UserProfile;
  onUpdatePlatforms: (updatedPlatforms: ConnectedPlatform[]) => void;
}

export const SocialAccountsView: React.FC<SocialAccountsViewProps> = ({ client, currentUser, onUpdatePlatforms }) => {
  const [platforms, setPlatforms] = useState<ConnectedPlatform[]>(client.platforms);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Handle Permanent Deletion of Social Media Handle (Requires can_delete_social_handle privilege)
  const handleDeletePlatform = async (id: string, name: string, connectionId?: string) => {
    if (currentUser && !currentUser.privileges.can_delete_social_handle) {
      setOauthError(`Access Denied: Your account role (${currentUser.role.toUpperCase()}) does not have the 'can_delete_social_handle' privilege. Please grant 'can_delete_social_handle' in Team & Access Rights.`);
      return;
    }

    try {
      if (connectionId) {
        const res = await authFetch(`/api/socials/connections/${encodeURIComponent(connectionId)}`, {
          method: 'DELETE',
        });
        const data = await readJsonOrThrow<{ success?: boolean; error?: string }>(res);
        if (!data.success) throw new Error(data.error || 'Could not disconnect account.');
      }
      const updated = platforms.filter((p) => p.id !== id);
      setPlatforms(updated);
      onUpdatePlatforms(updated);
      setDeletingId(null);
      showToast(`Disconnected ${name} for ${client.name}`);
    } catch (err: any) {
      setOauthError(err.message || 'Could not disconnect account.');
    }
  };

  useEffect(() => {
    setPlatforms(client.platforms);
  }, [client.id, client.platforms]);

  useEffect(() => {
    let cancelled = false;
    void authFetch(`/api/socials/connections?clientId=${encodeURIComponent(client.id)}`)
      .then((res) => readJsonOrThrow<{ success?: boolean; connections?: unknown[] }>(res))
      .then((data) => {
        if (cancelled || !data.success) return;
        const live = connectionsToPlatforms(data.connections || []);
        if (live.length) {
          setPlatforms(live);
          onUpdatePlatforms(live);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client.id]);

  // New account form state
  const [selectedChannel, setSelectedChannel] = useState<PlatformType>('instagram');
  const [accountHandle, setAccountHandle] = useState('');
  const [customAccessToken, setCustomAccessToken] = useState('');
  const [oauthAuthTab, setOauthAuthTab] = useState<'popup' | 'token' | 'guide'>('popup');
  const [isOauthLoggingIn, setIsOauthLoggingIn] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [pendingAssets, setPendingAssets] = useState<Array<{ id: string; name: string; kind: string; pageName?: string; followers?: number }>>([]);
  const [metaAppReady, setMetaAppReady] = useState(false);

  const selectedFamily: ProviderFamily =
    selectedChannel === 'tiktok'
      ? 'tiktok'
      : selectedChannel === 'linkedin'
        ? 'linkedin'
        : selectedChannel === 'youtube' || selectedChannel === 'google_analytics' || selectedChannel === 'google_ads'
          ? 'google'
          : 'meta';

  // Listen for OAuth Success postMessage from Popup window
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        setOauthError(event.data.error || 'OAuth failed');
        setIsOauthLoggingIn(false);
        return;
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const platformType = (event.data.platform || selectedChannel) as PlatformType;

        setIsOauthLoggingIn(true);
        try {
          const list = await authFetch(`/api/socials/connections?clientId=${encodeURIComponent(client.id)}`);
          const payload = await readJsonOrThrow<{ success?: boolean; error?: string; connections?: unknown[] }>(list);
          if (payload.success) {
            const live = connectionsToPlatforms(payload.connections || []);
            setPlatforms(live);
            onUpdatePlatforms(live);
            if (event.data.needsSelection?.length) {
              setPendingAssets(event.data.needsSelection);
              setShowConnectModal(true);
              setOauthError('This Meta login can access multiple brand accounts. Choose the one for this client.');
            } else {
              setShowConnectModal(false);
              showToast(
                event.data.warning
                  ? `${event.data.accountName || platformType} signed in, but sync needs attention`
                  : event.data.canPublish === false && (platformType === 'instagram' || platformType === 'facebook')
                    ? `${event.data.accountName || platformType} connected for insights. Reconnect after adding publishing permissions on the Meta app.`
                    : `${event.data.accountName || platformType} connected`
              );
              if (event.data.warning) setOauthError(event.data.warning);
            }
          } else {
            setOauthError(payload.error || 'Connected, but could not refresh accounts.');
          }
        } catch (err: any) {
          console.error("OAuth token exchange error:", err);
          setOauthError("Failed to verify OAuth response from provider.");
        } finally {
          setIsOauthLoggingIn(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [platforms, selectedChannel, accountHandle]);

  // Handle Direct Instant OAuth Authorization
  const handleDirectOAuthConnect = async () => {
    setIsOauthLoggingIn(true);
    setOauthError(null);
    try {
      if (!customAccessToken.trim()) {
        setOauthError('Paste a real provider access token, or use Sign in with provider.');
        setIsOauthLoggingIn(false);
        return;
      }
      const res = await authFetch('/api/socials/connect', {
        method: 'POST',
        body: JSON.stringify({
          clientId: client.id,
          platform: selectedChannel,
          accessToken: customAccessToken.trim(),
        }),
      });
      const data = await readJsonOrThrow<{ success?: boolean; error?: string }>(res);
      if (data.success) {
        const list = await authFetch(`/api/socials/connections?clientId=${encodeURIComponent(client.id)}`);
        const payload = await readJsonOrThrow<{ connections?: unknown[] }>(list);
        const live = connectionsToPlatforms(payload.connections || []);
        setPlatforms(live);
        onUpdatePlatforms(live);
        setShowConnectModal(false);
        setCustomAccessToken('');
      } else {
        setOauthError(data.error || 'Token was rejected by the provider.');
      }
    } catch (err: any) {
      setOauthError(err.message || 'Error verifying access token');
    } finally {
      setIsOauthLoggingIn(false);
    }
  };
  const handleTriggerOauthPopup = async () => {
    setIsOauthLoggingIn(true);
    setOauthError(null);
    try {
      const redirectUri = oauthRedirectUri();
      const handle = accountHandle.trim().replace(/^@/, '');
      const qs = new URLSearchParams({
        clientId: client.id,
        redirectUri,
      });
      if (handle) qs.set('preferredAccount', handle);
      const res = await authFetch(`/api/auth/${selectedChannel}/url?${qs.toString()}`);
      const data = await readJsonOrThrow<{ success?: boolean; error?: string; url?: string }>(res);
      if (data.url) {
        const popupWidth = 600;
        const popupHeight = 700;
        const left = window.screen.width / 2 - popupWidth / 2;
        const top = window.screen.height / 2 - popupHeight / 2;

        const authWindow = window.open(
          data.url,
          `oauth_popup_${selectedChannel}`,
          `width=${popupWidth},height=${popupHeight},top=${top},left=${left},resizable=yes,scrollbars=yes`
        );

        if (!authWindow) {
          setOauthError('Browser blocked popup window. Please enable popups for this site.');
          setIsOauthLoggingIn(false);
        }
      } else {
        setOauthError(data.error || 'Provider OAuth is not configured on the server.');
        setIsOauthLoggingIn(false);
      }
    } catch (err: any) {
      setOauthError(err.message || 'Error connecting to OAuth endpoint');
      setIsOauthLoggingIn(false);
    }
  };

  const handleSyncAccount = async (id: string, platformType: PlatformType, handle: string) => {
    setSyncingId(id);
    try {
      const platform = platforms.find((p) => p.id === id);
      const res = await authFetch('/api/socials/sync', {
        method: 'POST',
        body: JSON.stringify({
          clientId: client.id,
          platform: platformType,
        }),
      });
      const data = await readJsonOrThrow<{ success?: boolean; error?: string }>(res);
      if (data.success) {
        const list = await authFetch(`/api/socials/connections?clientId=${encodeURIComponent(client.id)}`);
        const payload = await readJsonOrThrow<{ connections?: unknown[] }>(list);
        const live = connectionsToPlatforms(payload.connections || []);
        setPlatforms(live);
        onUpdatePlatforms(live);
        const failed = live.filter((row) => row.lastError);
        if (failed.length) {
          setOauthError(failed.map((row) => `${row.name}: ${row.lastError}`).join(' · '));
        } else {
          showToast('Live metrics synced from the provider API');
        }
      } else {
        setOauthError(data.error || 'Sync failed');
      }
    } catch (err) {
      console.error("Failed to sync live API:", err);
    } finally {
      setSyncingId(null);
    }
  };

  const handleReconnect = (platform: PlatformType) => {
    setSelectedChannel(platform);
    setShowConnectModal(true);
    setOauthAuthTab('popup');
    setOauthError(
      platform === 'instagram' || platform === 'facebook'
        ? 'Sign in again and accept publishing. Those permissions must be on your Facebook Login for Business configuration (instagram_content_publish and pages_manage_posts), not sent as OAuth scope by this app.'
        : null
    );
    void (async () => {
      setSelectedChannel(platform);
      setIsOauthLoggingIn(true);
      try {
        const redirectUri = oauthRedirectUri();
        const handle = accountHandle.trim().replace(/^@/, '');
        const qs = new URLSearchParams({ clientId: client.id, redirectUri });
        if (handle) qs.set('preferredAccount', handle);
        const res = await authFetch(`/api/auth/${platform}/url?${qs.toString()}`);
        const data = await readJsonOrThrow<{ success?: boolean; error?: string; url?: string }>(res);
        if (!data.url) throw new Error(data.error || 'Could not start reconnect.');
        const authWindow = window.open(
          data.url,
          `oauth_popup_${platform}`,
          'width=600,height=700,resizable=yes,scrollbars=yes'
        );
        if (!authWindow) throw new Error('Browser blocked the popup. Allow popups, then retry.');
      } catch (err: any) {
        setOauthError(err.message || 'Could not start reconnect.');
        setIsOauthLoggingIn(false);
      }
    })();
  };

  const handleToggleConnection = (id: string) => {
    const platform = platforms.find((p) => p.id === id);
    if (platform?.connected) {
      void handleDeletePlatform(id, platform.name, platform.connectionId);
      return;
    }
    setShowConnectModal(true);
    setSelectedChannel(id);
  };

  const handleBindAsset = async (externalId: string) => {
    setIsOauthLoggingIn(true);
    setOauthError(null);
    try {
      const res = await authFetch('/api/socials/bind', {
        method: 'POST',
        body: JSON.stringify({ clientId: client.id, platform: selectedChannel, externalId }),
      });
      const data = await readJsonOrThrow<{ success?: boolean; error?: string }>(res);
      if (!data.success) throw new Error(data.error || 'Could not bind that brand account.');
      const list = await authFetch(`/api/socials/connections?clientId=${encodeURIComponent(client.id)}`);
      const payload = await readJsonOrThrow<{ connections?: unknown[] }>(list);
      const live = connectionsToPlatforms(payload.connections || []);
      setPlatforms(live);
      onUpdatePlatforms(live);
      setPendingAssets([]);
      setShowConnectModal(false);
      showToast('Brand account linked. Audience will fill after Insights sync.');
    } catch (err: any) {
      setOauthError(err.message);
    } finally {
      setIsOauthLoggingIn(false);
    }
  };

  const handleConnectNewAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (oauthAuthTab === 'token') {
      void handleDirectOAuthConnect();
      return;
    }
    void handleTriggerOauthPopup();
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      <ConnectAccountsPrompt client={client} />
      <MetaOnboarding client={client} compact />

      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-bold text-white">Social accounts</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Connect and sync Instagram, Facebook, TikTok, and other accounts for <span className="text-indigo-300 font-semibold">{client.name}</span>.
          </p>
        </div>
        <button
          onClick={() => setShowConnectModal(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Connect New Social Channel</span>
        </button>
      </div>

      {/* Connected Channels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {platforms.map((p, idx) => {
          const isSyncing = syncingId === p.id;
          return (
            <div
              key={`${p.id}-${p.accountName || idx}`}
              className={`bg-slate-900 border rounded-2xl p-5 shadow-xl space-y-4 transition-all relative ${
                p.connected ? 'border-slate-800 hover:border-slate-700' : 'border-slate-800 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center font-bold text-indigo-400">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{p.name}</h3>
                    <p className="text-xs text-indigo-300 font-mono">{p.accountName}</p>
                  </div>
                </div>

                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  p.connected
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {p.connected ? 'Active Sync' : 'Disconnected'}
                </span>
              </div>
              {(p.id === 'instagram' || p.id === 'facebook') && p.connected && (
                <p className={`text-[11px] leading-relaxed ${p.canPublish ? 'text-emerald-300' : 'text-amber-200'}`}>
                  {p.canPublish
                    ? 'Calendar can publish to this professional account.'
                    : p.publishReadyNote || 'Reconnect Meta and accept publishing so the calendar can post.'}
                </p>
              )}

              {/* Stats Box */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Audience / Followers</span>
                  <span className="font-extrabold text-white text-sm">
                    {p.followers > 0 ? p.followers.toLocaleString() : 'N/A (Ad Account)'}
                  </span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Growth Rate</span>
                  <span className="font-extrabold text-emerald-400 text-sm">+{p.growthRate}%</span>
                </div>
              </div>

              {/* Sync Health & Action Footer */}
              {(p.lastError || p.audienceNote) && (
                <p className="text-[11px] leading-relaxed text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-2">
                  {p.lastError || p.audienceNote}
                </p>
              )}

              {p.connected && (
                <div className="flex items-center justify-between text-[10px] text-slate-400 bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
                  <span className={`flex items-center gap-1 ${p.lastError ? 'text-amber-300' : 'text-emerald-400'}`}>
                    <Zap className="w-3 h-3" />
                    <span>Provider API {p.lastError ? 'error' : p.apiStatus === 'live' ? 'connected' : p.apiStatus || 'unknown'}</span>
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <ClockIcon className="w-3.5 h-3.5 text-slate-500" />
                  <span>{p.lastSync}</span>
                </div>

                <div className="flex items-center gap-2">
                  {(p.id === 'instagram' || p.id === 'facebook') && p.connected && !p.canPublish && (
                    <button
                      onClick={() => handleReconnect(p.id)}
                      className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/30 cursor-pointer font-semibold text-[11px]"
                    >
                      Reconnect
                    </button>
                  )}
                  <button
                    onClick={() => handleSyncAccount(p.id, p.id, p.accountName)}
                    disabled={isSyncing || !p.connected}
                    className="px-2 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 cursor-pointer transition-all flex items-center gap-1 font-semibold text-[11px]"
                    title="Force Live API Sync"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-cyan-400' : ''}`} />
                    <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
                  </button>

                  <button
                    onClick={() => handleToggleConnection(p.id)}
                    className={`px-2 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition-all ${
                      p.connected
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    {p.connected ? 'Disconnect' : 'Connect'}
                  </button>

                  {deletingId === p.id ? (
                    <div className="flex items-center gap-1.5 animate-fadeIn">
                      <button
                        onClick={() => void handleDeletePlatform(p.id, p.name, p.connectionId)}
                        className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] shadow-md cursor-pointer transition-all flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Confirm Delete</span>
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        if (currentUser && !currentUser.privileges.can_delete_social_handle) {
                          setOauthError(`Access Denied: Your role (${currentUser.role.toUpperCase()}) does not have 'can_delete_social_handle' privilege.`);
                          return;
                        }
                        setDeletingId(p.id);
                      }}
                      className="p-1 rounded-lg bg-slate-950 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/40 cursor-pointer transition-all"
                      title={currentUser?.privileges.can_delete_social_handle ? "Delete Social Media Handle" : "Delete requires Admin Privilege (can_delete_social_handle)"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Connect Account Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Link2 className="w-5 h-5 text-cyan-400" />
                Connect a brand account
              </h3>
              <button
                onClick={() => setShowConnectModal(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            {/* Auth Mode Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
              <button
                type="button"
                onClick={() => setOauthAuthTab('popup')}
                className={`py-1.5 px-2 rounded-lg font-bold transition-all ${
                  oauthAuthTab === 'popup' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setOauthAuthTab('token')}
                className={`py-1.5 px-2 rounded-lg font-bold transition-all ${
                  oauthAuthTab === 'token' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Direct Access Token
              </button>
              <button
                type="button"
                onClick={() => setOauthAuthTab('guide')}
                className={`py-1.5 px-2 rounded-lg font-bold transition-all ${
                  oauthAuthTab === 'guide' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                OAuth Config Guide
              </button>
            </div>

            {oauthError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 font-medium">
                ⚠️ {oauthError}
              </div>
            )}

            {pendingAssets.length > 0 && (
              <div className="space-y-2 rounded-xl border border-cyan-500/30 bg-slate-950 p-3">
                <p className="text-xs font-semibold text-cyan-200">Select this brand’s professional account</p>
                {pendingAssets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    disabled={isOauthLoggingIn}
                    onClick={() => void handleBindAsset(asset.id)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-800 px-3 py-2 text-left text-xs text-slate-200 hover:border-cyan-500/40"
                  >
                    <span>
                      <span className="font-semibold text-white">{asset.name}</span>
                      {asset.pageName ? <span className="ml-2 text-slate-500">· {asset.pageName}</span> : null}
                    </span>
                    <span className="text-[10px] uppercase text-slate-500">{asset.kind}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Select Network / Channel</label>
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value as PlatformType)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium"
                >
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook Page</option>
                  <option value="youtube">YouTube</option>
                  <option value="google_analytics">Google Analytics</option>
                  <option value="linkedin">LinkedIn Page</option>
                  <option value="tiktok">TikTok</option>
                  <option value="meta_ads">Meta Ads</option>
                  <option value="google_ads">Google Ads</option>
                </select>
              </div>

              {oauthAuthTab === 'popup' && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Brand handle or Page ID (optional)
                    </label>
                    <input
                      type="text"
                      value={accountHandle}
                      onChange={(e) => setAccountHandle(e.target.value)}
                      placeholder="e.g. @auraskin_official"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      This is not the Meta App ID. After Facebook login, we use it to pick this brand if the user manages several accounts.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Sign in with this network
                    </span>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Facebook Login for Business needs a numeric App ID and Configuration ID saved below. Permissions come from that configuration, not from this app. Then sign in with the brand’s Instagram/Facebook user.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleTriggerOauthPopup}
                    disabled={isOauthLoggingIn || (selectedFamily === 'meta' && !metaAppReady)}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all text-xs"
                  >
                    {isOauthLoggingIn ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Opening provider login…</span>
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Sign in with provider</span>
                      </>
                    )}
                  </button>
                  {selectedFamily === 'meta' && !metaAppReady && (
                    <p className="text-[11px] text-amber-200">
                      Save a numeric Meta App ID and Login for Business Configuration ID below before Facebook login will work.
                    </p>
                  )}

                  <ProviderOnboarding
                    family={selectedFamily}
                    client={client}
                    compact
                    onStatus={(status) =>
                      setMetaAppReady(
                        selectedFamily === 'meta' ? Boolean(status.appIdValid && status.configIdSet) : true
                      )
                    }
                  />
                </div>
              )}

              {/* Tab 2: Access Token Input */}
              {oauthAuthTab === 'token' && (
                <form onSubmit={handleConnectNewAccount} className="space-y-3 pt-1">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Paste Access Token / API Key</label>
                    <input
                      type="password"
                      value={customAccessToken}
                      onChange={(e) => setCustomAccessToken(e.target.value)}
                      placeholder="e.g. EAACEdEose0cBA..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs"
                    />
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Token is validated against the provider API. Followers and spend come from that API, not this form.
                  </p>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg cursor-pointer transition-all"
                  >
                    Verify & Connect Token
                  </button>
                </form>
              )}

              {/* Tab 3: OAuth Setup Guide */}
              {oauthAuthTab === 'guide' && (
                <div className="space-y-3 p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-300">
                  <span className="font-bold text-white block text-xs">How to get Meta credentials</span>
                  <ol className="list-decimal space-y-2 pl-4 text-slate-400">
                    <li>
                      Open{' '}
                      <a
                        className="text-cyan-300 underline"
                        href="https://developers.facebook.com/apps"
                        target="_blank"
                        rel="noreferrer"
                      >
                        developers.facebook.com/apps
                      </a>{' '}
                      and create or select your app.
                    </li>
                    <li>
                      Add <span className="text-slate-200">Facebook Login for Business</span>. Create a configuration that
                      includes Instagram insights/publish and Page publishing permissions. Ads permissions only if you
                      connect Meta Ads.
                    </li>
                    <li>
                      Go to <span className="text-slate-200">Settings → Basic</span>. Copy the{' '}
                      <span className="text-slate-200">App ID</span> (digits only) and{' '}
                      <span className="text-slate-200">App Secret</span>. An Instagram @handle is not an App ID.
                    </li>
                    <li>
                      In Facebook Login for Business, add this as a Valid OAuth Redirect URI:
                      <div className="mt-1 bg-slate-900 p-2 rounded-lg border border-slate-800 font-mono text-cyan-300 text-[10px] break-all select-all">
                        {oauthRedirectUri()}
                      </div>
                    </li>
                    <li>
                      Copy the <span className="text-slate-200">Configuration ID</span>. On the{' '}
                      <span className="text-slate-200">Sign in</span> tab, paste App ID, Secret, and Configuration ID,
                      save, then click Sign in with provider for this brand.
                    </li>
                  </ol>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowConnectModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 font-semibold rounded-xl hover:bg-slate-700 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function ClockIcon(props: any) {
  return (
    <svg
      {...props}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2" />
    </svg>
  );
}
