import React from 'react';
import { ChevronDown, Menu } from 'lucide-react';
import { ClientProfile, CurrencyCode, UserProfile } from '../types';
import { BrandMark } from './BrandIcons';

interface HeaderNavProps {
  clients: ClientProfile[];
  selectedClient: ClientProfile;
  onSelectClient: (client: ClientProfile) => void;
  mode: 'platform' | 'blueprint';
  setMode: (mode: 'platform' | 'blueprint') => void;
  whiteLabelMode: boolean;
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  currentUser: UserProfile;
  onOpenLoginModal: () => void;
  onOpenPrivilegesModal: () => void;
  onToggleMobileSidebar: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  clients,
  selectedClient,
  onSelectClient,
  mode,
  whiteLabelMode,
  onToggleMobileSidebar,
}) => {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#070b12]/80 text-slate-100 backdrop-blur-xl">
      <div className="w-full px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleMobileSidebar}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-slate-300 transition hover:bg-white/[0.06] hover:text-white lg:hidden"
              title="Toggle Navigation Menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <BrandMark className="h-9 w-9" />
              <span className="font-display truncate text-xl font-medium tracking-tight text-white">
                {whiteLabelMode ? 'AgencyPulse' : 'GrowthOS'}
              </span>
            </div>
          </div>

          {mode === 'platform' && (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-white/[0.06]"
              >
                <img
                  src={selectedClient.logo}
                  alt={selectedClient.name}
                  className="h-5 w-5 rounded-md object-cover"
                />
                <span className="hidden max-w-[160px] truncate sm:inline">{selectedClient.name}</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1520] py-1 shadow-2xl">
                  <div className="border-b border-white/[0.06] px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Active client
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {clients.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          onSelectClient(c);
                          setDropdownOpen(false);
                        }}
                        className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-white/[0.04] ${
                          selectedClient.id === c.id
                            ? 'border-l-2 border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-white'
                            : 'text-slate-300'
                        }`}
                      >
                        <img
                          src={c.logo}
                          alt={c.name}
                          className="h-6 w-6 shrink-0 rounded-md object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-white">{c.name}</p>
                          <p className="truncate text-[10px] text-slate-500">{c.industryLabel}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
