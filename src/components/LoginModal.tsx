import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  ShieldCheck, 
  Zap, 
  LogIn, 
  CheckCircle2, 
  Globe, 
  ArrowRight,
  UserCheck
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserProfile[];
  currentUser: UserProfile;
  onLogin: (user: UserProfile) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  users,
  currentUser,
  onLogin,
}) => {
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [selectedRoleTab, setSelectedRoleTab] = useState<UserRole>('admin');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  if (!isOpen) return null;

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setTimeout(() => {
      // Find user matching role or default
      const matched = users.find((u) => u.role === selectedRoleTab) || users[0];
      onLogin(matched);
      setIsLoggingIn(false);
      onClose();
    }, 600);
  };

  const handleDirectRoleLogin = (user: UserProfile) => {
    setIsLoggingIn(true);
    setTimeout(() => {
      onLogin(user);
      setIsLoggingIn(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6">
        {/* Header Logo */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-400 p-0.5 mx-auto shadow-lg shadow-indigo-500/30 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Zap className="w-6 h-6 text-cyan-400" />
            </div>
          </div>
          <h2 className="text-xl font-extrabold text-white">GrowthOS Authentication & Access Portal</h2>
          <p className="text-xs text-slate-400">
            Sign in with your enterprise credentials or choose a team role to test privilege levels.
          </p>
        </div>

        {/* Current Session Indicator */}
        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={currentUser.avatar} alt={currentUser.name} className="w-8 h-8 rounded-full object-cover border border-indigo-500" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Currently Signed In</p>
              <p className="text-xs font-bold text-white">{currentUser.name}</p>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {currentUser.role}
          </span>
        </div>

        {/* 1-Click Role-Based Quick Authentication */}
        <div className="space-y-3">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
            1-Click Authenticate as Agency Role:
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {users.map((u) => {
              const isCurrent = u.id === currentUser.id;
              return (
                <button
                  key={u.id}
                  onClick={() => handleDirectRoleLogin(u)}
                  disabled={isLoggingIn}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                    isCurrent
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                      u.role === 'admin' ? 'bg-indigo-500/30 text-indigo-200' :
                      u.role === 'manager' ? 'bg-cyan-500/30 text-cyan-200' : 'bg-emerald-500/30 text-emerald-200'
                    }`}>
                      {u.role}
                    </span>
                    {isCurrent && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <p className="text-xs font-bold truncate">{u.name.split(' ')[0]}</p>
                  <p className="text-[9px] text-slate-400 truncate">{u.role === 'admin' ? 'All Privileges' : u.role === 'manager' ? 'Accounts & Invoicing' : 'Calendar & Socials'}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Standard Email & Password Form */}
        <div className="border-t border-slate-800 pt-4 space-y-3">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
            Or Sign In with Corporate Email:
          </span>

          <form onSubmit={handleCustomSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Work Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="admin@growthos.ai"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-1.5 text-slate-400 text-[11px] cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded border-slate-800 bg-slate-950" />
                <span>Remember Session</span>
              </label>
              <a href="#forgot" onClick={(e) => e.preventDefault()} className="text-[11px] text-indigo-400 hover:underline">
                OAuth Password Reset
              </a>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              {isLoggingIn ? (
                <>
                  <Zap className="w-4 h-4 animate-spin text-cyan-300" />
                  <span>Authenticating GrowthOS Token...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-white" />
                  <span>Sign In & Verify OAuth Scope</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>SOC2 & OAuth 2.0 Encryption Active</span>
          </span>
          <button onClick={onClose} className="text-slate-400 hover:text-white font-semibold">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
