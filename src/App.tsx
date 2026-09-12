import React, { useState, useEffect, useCallback } from 'react';
import { HeaderNav } from './components/HeaderNav';
import { SidebarNav } from './components/SidebarNav';
import { OverviewDashboard } from './components/OverviewDashboard';
import { GrowthIntelligenceView } from './components/GrowthIntelligenceView';
import { AudienceDnaView } from './components/AudienceDnaView';
import { ConversionAttributionView } from './components/ConversionAttributionView';
import { CampaignManagerView } from './components/CampaignManagerView';
import { ContentCalendarView } from './components/ContentCalendarView';
import { CalendarBriefView } from './components/CalendarBriefView';
import { WhatsAppInboxView } from './components/WhatsAppInboxView';
import { AgencyHubView } from './components/AgencyHubView';
import { InvoiceManagementView } from './components/InvoiceManagementView';
import { TeamPrivilegesModal } from './components/TeamPrivilegesModal';
import { UserProfileModal } from './components/UserProfileModal';
import { SettingsView } from './components/SettingsView';
import { AuthOnboardingModal } from './components/AuthOnboardingModal';
import { FeatureOnboardingModal } from './components/FeatureOnboardingModal';
import { SplashScreen } from './components/SplashScreen';
import { ClientProfile, CurrencyCode, UserProfile } from './types';
import { WorkspaceLocaleProvider } from './lib/WorkspaceLocale';
import { BlueprintExplorerView } from './components/BlueprintExplorerView';
import { flushDuePosts } from './lib/calendarPublishApi';
import {
  subscribeToClients,
  subscribeToUsers,
  subscribeToAuthState,
  saveUser,
  saveClient,
  logoutUser,
  updatePassword,
  deleteProfile,
  saveWorkspacePreferences,
  bootstrapSupabaseConfig,
} from './lib/supabase';

export default function App() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(null);
  const [activeView, setActiveView] = useState<string>('overview');
  const [whiteLabelMode, setWhiteLabelMode] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [currency, setCurrency] = useState<CurrencyCode>('NGN');
  const [dataReady, setDataReady] = useState(false);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(true);
  const [showFeatureTour, setShowFeatureTour] = useState(false);
  const [isPrivilegesModalOpen, setIsPrivilegesModalOpen] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryConfirm, setRecoveryConfirm] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalInitialTab, setProfileModalInitialTab] = useState<'view' | 'edit'>('view');
  const [briefToken] = useState(() => new URLSearchParams(window.location.search).get('brief'));

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('view');
    if (initial) setActiveView(initial);
    const onNav = (event: Event) => {
      const view = (event as CustomEvent<string>).detail;
      if (view) setActiveView(view);
    };
    window.addEventListener('gos:navigate', onNav);
    return () => window.removeEventListener('gos:navigate', onNav);
  }, []);

  const handleSplashFinished = useCallback(() => setSplashDone(true), []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribeAuth: (() => void) | undefined;

    void bootstrapSupabaseConfig().finally(() => {
      if (cancelled) return;
      setBootstrapped(true);

      unsubscribeAuth = subscribeToAuthState(
        (profile) => {
          setCurrentUser(profile);
          setIsAuthenticated(Boolean(profile));
          setAuthReady(true);
          if (!profile) {
            setIsAuthModalOpen(true);
            setClients([]);
            setSelectedClient(null);
            setUsers([]);
            setDataReady(false);
          } else if (profile.preferences?.currency) {
            setCurrency(profile.preferences.currency);
          }
          if (profile?.preferences?.whiteLabelMode != null) {
            setWhiteLabelMode(Boolean(profile.preferences.whiteLabelMode));
          }
        },
        () => setShowRecovery(true)
      );
    });

    return () => {
      cancelled = true;
      unsubscribeAuth?.();
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setAuthReady(true), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!currentUser?.orgId) return;
    void flushDuePosts().catch(() => undefined);
  }, [currentUser?.orgId]);

  useEffect(() => {
    if (splashDone && !isAuthenticated) {
      setIsAuthModalOpen(true);
    }
  }, [splashDone, isAuthenticated]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const clientId = params.get('client');
    if (view) setActiveView(view);
    if (clientId) {
      (window as any).__growthosShareClient = clientId;
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    setDataReady(true);

    const unsubscribeClients = subscribeToClients((liveClients) => {
      setClients(liveClients);
      setSelectedClient((prev) => {
        const shareId = (window as any).__growthosShareClient as string | undefined;
        if (shareId) {
          const shared = liveClients.find((c) => c.id === shareId);
          if (shared) {
            delete (window as any).__growthosShareClient;
            return shared;
          }
        }
        if (prev) {
          const found = liveClients.find((c) => c.id === prev.id);
          if (found) return found;
        }
        return liveClients[0] || null;
      });
    });

    const unsubscribeUsers = subscribeToUsers((liveUsers) => {
      setUsers(liveUsers);
      setCurrentUser((prev) => {
        if (!prev) return prev;
        return liveUsers.find((u) => u.id === prev.id) || prev;
      });
    });

    return () => {
      unsubscribeClients();
      unsubscribeUsers();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser || showRecovery) return;
    if (currentUser.preferences?.featureTourSeen === false) {
      setShowFeatureTour(true);
    }
  }, [isAuthenticated, currentUser, showRecovery]);

  const persistClients = async (next: ClientProfile[]) => {
    setClients(next);
    setSelectedClient((prev) => {
      if (!prev) return next[0] || null;
      return next.find((c) => c.id === prev.id) || next[0] || null;
    });
    const orgId = currentUser?.orgId;
    if (!orgId) {
      throw new Error('Your profile is missing an organization. Reload and complete sign-in again.');
    }
    await Promise.all(next.map((c) => saveClient(c, orgId)));
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.warn('Logout error:', err);
    }
    setCurrentUser(null);
    setIsAuthenticated(false);
    setIsAuthModalOpen(true);
  };

  useEffect(() => {
    fetch('/api/health')
      .then(async (res) => {
        const parsed = await import('./lib/httpJson').then((m) => m.readJsonResponse<any>(res));
        if (parsed.ok && typeof parsed.data?.hasApiKey === 'boolean') {
          setHasApiKey(parsed.data.hasApiKey);
        }
      })
      .catch(() => setHasApiKey(false));
  }, []);

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    if (recoveryPassword.length < 6) {
      setRecoveryError('Password must be at least 6 characters.');
      return;
    }
    if (recoveryPassword !== recoveryConfirm) {
      setRecoveryError('Passwords do not match.');
      return;
    }
    setRecoveryBusy(true);
    try {
      await updatePassword(recoveryPassword);
      setShowRecovery(false);
      setRecoveryPassword('');
      setRecoveryConfirm('');
      const url = new URL(window.location.href);
      url.searchParams.delete('recovery');
      window.history.replaceState({}, '', url.pathname + url.search);
    } catch (err: any) {
      setRecoveryError(err.message || 'Could not update password.');
    } finally {
      setRecoveryBusy(false);
    }
  };

  const handleFeatureTourComplete = async () => {
    setShowFeatureTour(false);
    if (!currentUser) return;
    try {
      const updated = await saveWorkspacePreferences(currentUser.id, {
        preferences: {
          ...(currentUser.preferences || {}),
          featureTourSeen: true,
        },
      });
      setCurrentUser(updated);
    } catch (err) {
      console.warn('Could not save tour preference:', err);
    }
  };

  if (briefToken) {
    return <CalendarBriefView token={briefToken} />;
  }

  if (!splashDone) {
    return (
      <SplashScreen
        ready={authReady || bootstrapped}
        onFinished={handleSplashFinished}
      />
    );
  }

  const activeUser = currentUser;
  const activeClient = selectedClient;
  const isAdminUser =
    activeUser?.role === 'admin' || activeUser?.role === 'super_admin';
  const can = (key: keyof NonNullable<UserProfile['privileges']>) =>
    Boolean(isAdminUser || activeUser?.privileges?.[key]);

  const accessDenied = (label: string) => (
    <div className="fade-rise mx-auto max-w-lg rounded-2xl border border-white/10 bg-[#0a1018] p-8 text-center">
      <h2 className="font-display text-2xl text-white">Access restricted</h2>
      <p className="mt-2 text-sm text-slate-400">
        Your role does not include {label}. Ask an admin to update privileges in Team.
      </p>
    </div>
  );

  return (
    <WorkspaceLocaleProvider
      languagePref={activeUser?.preferences?.language}
      timeZonePref={activeUser?.preferences?.timeZone}
    >
    <div className="flex min-h-screen flex-col bg-transparent text-slate-100 font-sans">
      <HeaderNav
        clients={clients}
        selectedClient={activeClient}
        onSelectClient={(c) => setSelectedClient(c)}
        whiteLabelMode={whiteLabelMode}
        currency={currency}
        setCurrency={setCurrency}
        currentUser={activeUser}
        isAuthenticated={isAuthenticated}
        onOpenLoginModal={() => setIsAuthModalOpen(true)}
        onOpenPrivilegesModal={() => setIsPrivilegesModalOpen(true)}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      <div className="relative flex flex-1">
        {isAuthenticated && (
        <SidebarNav
          activeView={activeView}
          setActiveView={setActiveView}
          selectedClient={activeClient}
          currentUser={activeUser}
          isAuthenticated={isAuthenticated}
          onLogout={handleLogout}
          onOpenProfileView={() => {
            setProfileModalInitialTab('view');
            setIsProfileModalOpen(true);
          }}
          onOpenProfileEdit={() => {
            setProfileModalInitialTab('edit');
            setIsProfileModalOpen(true);
          }}
          onOpenPrivilegesModal={() => setIsPrivilegesModalOpen(true)}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          mobileOpen={isMobileSidebarOpen}
          setMobileOpen={setIsMobileSidebarOpen}
        />
        )}

        <main
          className={`flex-1 px-3 py-4 transition-all duration-300 sm:px-6 sm:py-6 lg:px-8 ${
            isAuthenticated ? (isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64') : ''
          }`}
        >
          <div className="mx-auto max-w-7xl pb-8">
            {!isAuthenticated ? (
              <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center fade-rise">
                <h1 className="font-display text-3xl font-medium text-white">Sign in to GrowthOS</h1>
                <p className="max-w-md text-sm text-slate-400">
                  Access campaigns, calendar, agency tools, and growth insights.
                </p>
                <button onClick={() => setIsAuthModalOpen(true)} className="primary-button mt-2">
                  Open sign in
                </button>
              </div>
            ) : !dataReady || !activeUser ? (
              <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-400">
                Loading workspace data…
              </div>
            ) : !activeClient &&
              activeView !== 'agency' &&
              activeView !== 'settings' &&
              activeView !== 'team' &&
              activeView !== 'invoices' ? (
              <div className="fade-rise flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
                <h2 className="font-display text-2xl font-medium text-white">Create your first brand</h2>
                <p className="max-w-md text-sm text-slate-400">
                  Your workspace is empty. Add a client brand in Agency Hub to start campaigns, calendar planning, and AI insights.
                </p>
                <button onClick={() => setActiveView('agency')} className="primary-button">
                  Open Agency Hub
                </button>
              </div>
            ) : (
              <>
                {activeView === 'overview' && (
                  <OverviewDashboard
                    client={activeClient}
                    currency={currency}
                    onNavigateTab={(tab) => setActiveView(tab)}
                  />
                )}
                {activeView === 'campaigns' &&
                  (can('can_manage_campaigns') ? (
                    <CampaignManagerView client={activeClient} />
                  ) : (
                    accessDenied('campaign management')
                  ))}
                {activeView === 'calendar' &&
                  (can('can_manage_calendar') ? (
                  <ContentCalendarView
                    client={activeClient}
                    users={users.length ? users : activeUser ? [activeUser] : []}
                    currentUser={activeUser}
                  />
                  ) : (
                    accessDenied('calendar management')
                  ))}
                {activeView === 'whatsapp' && (
                  <WhatsAppInboxView
                    client={activeClient}
                    users={users.length ? users : activeUser ? [activeUser] : []}
                    currentUser={activeUser}
                  />
                )}
                {activeView === 'intelligence' && <GrowthIntelligenceView client={activeClient} />}
                {activeView === 'audience' && <AudienceDnaView client={activeClient} />}
                {activeView === 'attribution' && <ConversionAttributionView client={activeClient} />}
                {activeView === 'agency' &&
                  (can('can_create_account') || can('can_sync_social') ? (
                  <AgencyHubView
                    clients={clients}
                    selectedClient={activeClient}
                    currentUser={activeUser}
                    onAddClient={async (newClient) => {
                      const next = [...clients, newClient];
                      await persistClients(next);
                      setSelectedClient(newClient);
                    }}
                    onUpdateClientPlatforms={async (clientId, platforms) => {
                      const next = clients.map((c) =>
                        c.id === clientId ? { ...c, platforms } : c
                      );
                      await persistClients(next);
                    }}
                  />
                  ) : (
                    accessDenied('agency hub')
                  ))}
                {activeView === 'invoices' && (
                  <InvoiceManagementView
                    clients={clients}
                    currentUser={activeUser}
                    currency={currency}
                    setCurrency={setCurrency}
                    onUpdateClients={(updated) => {
                      void persistClients(updated);
                    }}
                  />
                )}
                {activeView === 'blueprint' && <BlueprintExplorerView />}
                {activeView === 'settings' && (
                  <SettingsView
                    currentUser={activeUser}
                    selectedClient={activeClient}
                    currency={currency}
                    setCurrency={setCurrency}
                    whiteLabelMode={whiteLabelMode}
                    setWhiteLabelMode={setWhiteLabelMode}
                    onUserUpdated={(u) => {
                      setCurrentUser(u);
                      if (u.preferences?.currency) setCurrency(u.preferences.currency);
                      if (u.preferences?.whiteLabelMode != null) {
                        setWhiteLabelMode(Boolean(u.preferences.whiteLabelMode));
                      }
                    }}
                  />
                )}
                {activeView === 'team' &&
                  (can('can_add_team') ? (
                  <TeamPrivilegesModal
                    isOpen
                    asPage
                    onClose={() => setActiveView('overview')}
                    users={users.length ? users : activeUser ? [activeUser] : []}
                    currentUser={activeUser}
                    onUpdateUsers={(updatedUsers) => {
                      setUsers(updatedUsers);
                      const updatedSelf = updatedUsers.find((u) => u.id === activeUser.id);
                      if (updatedSelf) setCurrentUser(updatedSelf);
                      updatedUsers.forEach((u) => void saveUser(u));
                    }}
                    onSelectActiveUser={(u) => setCurrentUser(u)}
                    onDeleteUser={async (userId) => {
                      await deleteProfile(userId);
                      setUsers((prev) => prev.filter((u) => u.id !== userId));
                    }}
                  />
                  ) : (
                    accessDenied('team management')
                  ))}
              </>
            )}
          </div>
        </main>
      </div>

      {activeUser && (
      <UserProfileModal
        isOpen={isProfileModalOpen && isAuthenticated}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={activeUser}
        initialTab={profileModalInitialTab}
        onUpdateCurrentUser={(updated) => {
          setCurrentUser(updated);
          void saveUser(updated);
        }}
        onLogout={handleLogout}
      />
      )}

      {activeUser && (
      <TeamPrivilegesModal
        isOpen={isPrivilegesModalOpen && isAuthenticated}
        onClose={() => setIsPrivilegesModalOpen(false)}
        users={users.length ? users : [activeUser]}
        currentUser={activeUser}
        onUpdateUsers={(updatedUsers) => {
          setUsers(updatedUsers);
          const updatedSelf = updatedUsers.find((u) => u.id === activeUser.id);
          if (updatedSelf) setCurrentUser(updatedSelf);
          updatedUsers.forEach((u) => void saveUser(u));
        }}
        onSelectActiveUser={(u) => setCurrentUser(u)}
        onDeleteUser={async (userId) => {
          await deleteProfile(userId);
          setUsers((prev) => prev.filter((u) => u.id !== userId));
        }}
      />
      )}

      {isAuthModalOpen && (
        <AuthOnboardingModal
          isOpen={isAuthModalOpen}
          onClose={() => {
            if (isAuthenticated) setIsAuthModalOpen(false);
          }}
          users={users}
          currentUser={activeUser}
          isAuthenticated={isAuthenticated}
          onLogin={(user) => {
            setCurrentUser(user);
            setIsAuthenticated(true);
            setIsAuthModalOpen(false);
            if (user.preferences?.featureTourSeen === false) {
              setShowFeatureTour(true);
            }
          }}
          onRegisterUser={(newUser) => {
            setUsers((prev) => {
              if (prev.some((u) => u.id === newUser.id)) return prev;
              return [...prev, newUser];
            });
          }}
          initialMode="signin"
        />
      )}

      <FeatureOnboardingModal
        isOpen={showFeatureTour && isAuthenticated}
        userName={currentUser?.name}
        onComplete={handleFeatureTourComplete}
      />

      {showRecovery && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#070b12]/90 p-4 backdrop-blur-md">
          <form onSubmit={handleRecoverySubmit} className="surface-panel w-full max-w-md space-y-4 p-6">
            <h2 className="font-display text-2xl text-white">Choose a new password</h2>
            <p className="text-sm text-slate-400">You opened a password recovery link. Set a new password to continue.</p>
            {recoveryError && (
              <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {recoveryError}
              </p>
            )}
            <input
              type="password"
              required
              minLength={6}
              value={recoveryPassword}
              onChange={(e) => setRecoveryPassword(e.target.value)}
              placeholder="New password"
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm text-white outline-none"
            />
            <input
              type="password"
              required
              minLength={6}
              value={recoveryConfirm}
              onChange={(e) => setRecoveryConfirm(e.target.value)}
              placeholder="Confirm password"
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm text-white outline-none"
            />
            <button type="submit" disabled={recoveryBusy} className="primary-button w-full justify-center">
              {recoveryBusy ? 'Saving…' : 'Update password'}
            </button>
          </form>
        </div>
      )}

      <footer className="border-t border-white/[0.06] py-4 text-center text-xs text-slate-500">
        <span>
          {whiteLabelMode ? 'AgencyPulse' : 'GrowthOS'} © 2026
          {!hasApiKey ? ' · Gemini API key missing' : ''}
        </span>
      </footer>
    </div>
    </WorkspaceLocaleProvider>
  );
}
