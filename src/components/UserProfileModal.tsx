import React, { useEffect, useState } from 'react';
import {
  Building2,
  Calendar,
  LogOut,
  Mail,
  Phone,
  Save,
  User,
  X,
} from 'lucide-react';
import { UserProfile } from '../types';
import { saveUser } from '../lib/supabase';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onUpdateCurrentUser: (updated: UserProfile) => void;
  onLogout: () => void;
  initialTab?: 'view' | 'edit';
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateCurrentUser,
  onLogout,
  initialTab = 'view',
}) => {
  const [activeTab, setActiveTab] = useState<'view' | 'edit'>(initialTab);
  const [name, setName] = useState(currentUser.name);
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [companyName, setCompanyName] = useState(currentUser.companyName || '');
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    setName(currentUser.name);
    setPhone(currentUser.phone || '');
    setCompanyName(currentUser.companyName || '');
    setAvatar(currentUser.avatar);
    setSaveMessage(null);
  }, [isOpen, initialTab, currentUser]);

  if (!isOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);

    const updatedUser: UserProfile = {
      ...currentUser,
      name,
      phone,
      companyName,
      avatar,
    };

    try {
      await saveUser(updatedUser);
      onUpdateCurrentUser(updatedUser);
      setSaveMessage('Profile updated');
      setTimeout(() => {
        setSaveMessage(null);
        setActiveTab('view');
      }, 1000);
    } catch (err) {
      console.error('Failed to save user profile:', err);
      setSaveMessage('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-md sm:items-center sm:p-4">
      <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-900 p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-4 border-b border-white/10 pb-5 pr-10">
          <div className="relative shrink-0">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="h-14 w-14 rounded-2xl object-cover sm:h-16 sm:w-16"
            />
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-900 bg-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-white">{currentUser.name}</h2>
              <span className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-200">
                {currentUser.role}
              </span>
            </div>
            <p className="truncate text-xs text-slate-400">{currentUser.email}</p>
            {currentUser.companyName && (
              <p className="mt-0.5 truncate text-[11px] text-cyan-300">{currentUser.companyName}</p>
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-2 rounded-2xl border border-white/10 bg-slate-950 p-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('view')}
            className={`flex-1 rounded-xl py-2 transition ${
              activeTab === 'view' ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            View
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`flex-1 rounded-xl py-2 transition ${
              activeTab === 'edit' ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            Edit
          </button>
        </div>

        {activeTab === 'view' && (
          <div className="mt-4 space-y-4 text-xs text-slate-300">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { label: 'Full name', value: currentUser.name, icon: User },
                { label: 'Email', value: currentUser.email, icon: Mail },
                { label: 'Phone', value: currentUser.phone || 'Not specified', icon: Phone },
                { label: 'Company', value: currentUser.companyName || 'GrowthOS Agency', icon: Building2 },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="surface-subtle space-y-1 p-3">
                    <p className="flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                      <Icon className="h-3 w-3 text-indigo-300" />
                      {item.label}
                    </p>
                    <p className="truncate font-medium text-white">{item.value}</p>
                  </div>
                );
              })}
            </div>

            <div className="surface-subtle flex items-center justify-between p-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Calendar className="h-3.5 w-3.5 text-indigo-300" />
                Member since
              </span>
              <span className="font-mono text-slate-200">
                {currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : 'Active'}
              </span>
            </div>

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <button onClick={() => setActiveTab('edit')} className="secondary-button justify-center">
                Edit profile
              </button>
              <button
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-rose-500/30 bg-rose-950/40 px-4 py-2.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-900/50"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Reset demo session</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'edit' && (
          <form onSubmit={handleSaveProfile} className="mt-4 space-y-3 text-xs">
            <div>
              <label className="mb-1 block text-slate-400">Full name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-slate-400">Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 019-2834"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">Company</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Apex Digital Agency"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-slate-400">Avatar URL</label>
              <input
                type="text"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2.5 font-mono text-[11px] text-white"
              />
            </div>

            {saveMessage && (
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-2.5 text-center font-medium text-emerald-300">
                {saveMessage}
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setActiveTab('view')} className="secondary-button justify-center">
                Cancel
              </button>
              <button type="submit" disabled={isSaving} className="primary-button justify-center">
                <Save className="h-4 w-4" />
                <span>{isSaving ? 'Saving...' : 'Save profile'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
