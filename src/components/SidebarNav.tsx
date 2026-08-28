import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, LogOut, User, Settings } from 'lucide-react';
import { ClientProfile, UserProfile } from '../types';
import { NAV_ICONS, NavIconId } from './BrandIcons';

interface SidebarNavProps {
  activeView: string;
  setActiveView: (view: string) => void;
  selectedClient: ClientProfile | null;
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  onLogout: () => void;
  onOpenProfileView: () => void;
  onOpenProfileEdit: () => void;
  onOpenPrivilegesModal: () => void;
  mode: 'platform' | 'blueprint';
  setMode: (mode: 'platform' | 'blueprint') => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

interface NavItem {
  id: NavIconId;
  label: string;
  helper: string;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeView,
  setActiveView,
  selectedClient,
  currentUser,
  isAuthenticated,
  onLogout,
  onOpenProfileView,
  onOpenProfileEdit,
  onOpenPrivilegesModal,
  isCollapsed,
  setIsCollapsed,
  mobileOpen,
  setMobileOpen,
}) => {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const allNavItems: NavItem[] = [
    { id: 'overview', label: 'Overview', helper: 'Today at a glance' },
    { id: 'campaigns', label: 'Campaigns', helper: 'Objective-first planning' },
    { id: 'calendar', label: 'Content Calendar', helper: 'Schedule and production' },
    { id: 'whatsapp', label: 'WhatsApp Inbox', helper: 'Leads and conversations' },
    { id: 'intelligence', label: 'Growth AI Suite', helper: 'Insights and generation' },
    { id: 'attribution', label: 'Analytics', helper: 'Performance and revenue' },
    { id: 'audience', label: 'Audience DNA', helper: 'Segments and triggers' },
    { id: 'agency', label: 'Agency Hub', helper: 'Clients and social accounts' },
    { id: 'invoices', label: 'Invoices', helper: 'Billing and payments' },
    { id: 'team', label: 'Team', helper: 'Members and privileges' },
    { id: 'settings', label: 'Settings', helper: 'Workspace preferences' },
  ];
  const navItems = allNavItems.filter((item) => {
    if (!currentUser) return true;
    const p = currentUser.privileges;
    if (!p) return true;
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin';
    if (item.id === 'campaigns') return isAdmin || p.can_manage_campaigns;
    if (item.id === 'calendar') return isAdmin || p.can_manage_calendar;
    if (item.id === 'invoices') return isAdmin || p.can_invoice_management;
    if (item.id === 'team') return isAdmin || p.can_add_team;
    if (item.id === 'agency') return isAdmin || p.can_create_account || p.can_sync_social;
    return true;
  });

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed top-16 bottom-0 left-0 z-40 flex w-[min(16.5rem,86vw)] flex-col justify-between border-r border-white/[0.06] bg-[#070b12]/95 backdrop-blur-xl transition-all duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed && !mobileOpen ? 'lg:w-16' : 'lg:w-60'}`}
      >
        <div className="flex-1 space-y-3 overflow-y-auto px-2.5 py-4 scrollbar-none">
          {(!isCollapsed || mobileOpen) && selectedClient && (
            <div className="px-2 pb-1">
              <p className="truncate text-xs text-slate-500">{selectedClient.name}</p>
            </div>
          )}

          <div className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = NAV_ICONS[item.id as NavIconId] || NAV_ICONS.settings;
              const isActive = activeView === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveView(item.id);
                    if (mobileOpen) setMobileOpen(false);
                  }}
                  title={item.helper}
                  className={`w-full rounded-xl px-2.5 py-2.5 text-left transition ${
                    isActive ? 'nav-active' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 shrink-0" active={isActive} />
                    {(!isCollapsed || mobileOpen) && (
                      <p className={`truncate text-sm ${isActive ? 'font-medium text-white' : 'text-slate-300'}`}>
                        {item.label}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative space-y-2 border-t border-white/[0.06] p-2.5">
          {currentUser && (!isCollapsed || mobileOpen) ? (
            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.03]"
              >
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="h-8 w-8 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{currentUser.name}</p>
                  <p className="truncate text-[11px] text-slate-500">{currentUser.role.replace('_', ' ')}</p>
                </div>
              </button>

              {profileMenuOpen && (
                <div className="absolute bottom-full left-0 z-50 mb-2 w-full space-y-0.5 overflow-hidden rounded-xl border border-white/10 bg-[#0d1520] p-1 shadow-2xl">
                  <button
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onOpenProfileView();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/[0.04]"
                  >
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span>View profile</span>
                  </button>
                  <button
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onOpenProfileEdit();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/[0.04]"
                  >
                    <Settings className="h-3.5 w-3.5 text-slate-400" />
                    <span>Edit profile</span>
                  </button>
                  <button
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onLogout();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-rose-300 hover:bg-rose-950/40"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          ) : currentUser ? (
            <div className="flex flex-col items-center gap-2">
              <button onClick={() => onOpenProfileView()} title={currentUser.name}>
                <img src={currentUser.avatar} alt="" className="h-8 w-8 rounded-lg object-cover" />
              </button>
              <button onClick={onLogout} className="p-2 text-slate-500 hover:text-rose-300" title="Log out">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden w-full items-center justify-center gap-2 rounded-xl py-2 text-xs text-slate-500 transition hover:bg-white/[0.03] hover:text-slate-300 lg:flex"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};
