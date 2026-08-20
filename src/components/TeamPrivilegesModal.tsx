import React, { useState } from 'react';
import { 
  Users, 
  ShieldCheck, 
  CheckSquare, 
  Square, 
  Plus, 
  UserPlus, 
  Shield, 
  Trash2, 
  CheckCircle2, 
  Key,
  UserCheck
} from 'lucide-react';
import { UserProfile, UserRole, UserPrivileges } from '../types';
import { DEFAULT_ROLE_PRIVILEGES } from '../data/mockUsers';
import { inviteTeamMember } from '../lib/supabase';

interface TeamPrivilegesModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserProfile[];
  currentUser: UserProfile;
  onUpdateUsers: (updatedUsers: UserProfile[]) => void;
  onSelectActiveUser: (user: UserProfile) => void;
  onDeleteUser?: (userId: string) => Promise<void>;
  /** Render as a full page (nav Team) instead of a modal overlay */
  asPage?: boolean;
}

export const TeamPrivilegesModal: React.FC<TeamPrivilegesModalProps> = ({
  isOpen,
  onClose,
  users,
  currentUser,
  onUpdateUsers,
  onSelectActiveUser,
  onDeleteUser,
  asPage = false,
}) => {
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser.id);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('manager');
  const [newDepartment, setNewDepartment] = useState('Growth Operations');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  if (!isOpen && !asPage) return null;

  const activeInspectedUser = users.find((u) => u.id === selectedUserId) || currentUser;
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleTogglePrivilege = (userId: string, privKey: keyof UserPrivileges) => {
    if (!isAdmin) {
      showToast('Access Denied: Only Administrators can modify user privilege checkboxes!');
      return;
    }

    const updated = users.map((u) => {
      if (u.id === userId) {
        return {
          ...u,
          privileges: {
            ...u.privileges,
            [privKey]: !u.privileges[privKey],
          },
        };
      }
      return u;
    });

    onUpdateUsers(updated);
    showToast(`Privilege updated for ${activeInspectedUser.name}`);
  };

  const handleDeleteTeamMember = async (targetUserId: string, targetName: string) => {
    if (!isAdmin && !currentUser.privileges.can_add_team) {
      showToast('Access Denied: Admin or "can_add_team" privilege required to remove team members.');
      return;
    }

    if (users.length <= 1) {
      showToast('Action Denied: Cannot delete the last remaining team member.');
      return;
    }

    try {
      if (onDeleteUser) await onDeleteUser(targetUserId);
      const updatedUsers = users.filter((u) => u.id !== targetUserId);
      onUpdateUsers(updatedUsers);
      setDeletingUserId(null);
      if (selectedUserId === targetUserId) {
        setSelectedUserId(updatedUsers[0].id);
      }
      showToast(`Removed team member ${targetName}`);
    } catch (err: any) {
      showToast(err.message || 'Could not delete team member.');
    }
  };

  const handleAddTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) return;

    if (!isAdmin && !currentUser.privileges.can_add_team) {
      showToast('Access Denied: you cannot invite teammates.');
      return;
    }

    try {
      await inviteTeamMember({
        email: newEmail,
        name: newName,
        role: newRole,
        department: newDepartment,
        privileges: { ...DEFAULT_ROLE_PRIVILEGES[newRole] },
        invitedBy: currentUser.id,
        orgId: currentUser.orgId,
      });
      setShowAddUserModal(false);
      setNewName('');
      setNewEmail('');
      showToast(`Invite saved for ${newEmail}. They join by signing up with that email.`);
    } catch (err: any) {
      showToast(err.message || 'Invite failed.');
    }
  };

  const privilegeDefinitions: { key: keyof UserPrivileges; label: string; description: string }[] = [
    {
      key: 'can_create_account',
      label: 'Create Client Accounts & Profiles',
      description: 'Allows onboard new agency clients, brand profiles, and client configurations.',
    },
    {
      key: 'can_delete_social_handle',
      label: 'Delete Social Media Handles',
      description: 'Allows unlinking or permanently removing connected social media channels.',
    },
    {
      key: 'can_add_team',
      label: 'Manage Team Members & Access Rights',
      description: 'Allows adding team members, assigning roles, and tweaking privilege checkboxes.',
    },
    {
      key: 'can_invoice_management',
      label: 'Invoice & Payment Management',
      description: 'Allows viewing billing dates, raising invoices, switching currency, and clearing outstanding balances.',
    },
    {
      key: 'can_manage_campaigns',
      label: 'Campaign & Funnel Strategy Engine',
      description: 'Allows launching, pausing, and configuring marketing campaigns & funnel stages.',
    },
    {
      key: 'can_manage_calendar',
      label: 'Content Calendar & Creative Optimizer',
      description: 'Allows editing content schedules, hooks, captions, and approving designer assets.',
    },
    {
      key: 'can_sync_social',
      label: 'Live Social Media API Sync',
      description: 'Allows triggering on-demand OAuth re-authentication & live Graph API data synchronization.',
    },
  ];

  const shellClass = asPage
    ? 'fade-rise space-y-6'
    : 'fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4';
  const panelClass = asPage
    ? 'surface-panel space-y-6 p-5 sm:p-6'
    : 'bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-3xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto';

  return (
    <div className={shellClass}>
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className={panelClass}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
              <ShieldCheck className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Team Roles & Access Rights Privileges
              </h2>
              <p className="text-xs text-slate-400">
                Assign granular privilege checkboxes for Admin, Manager, and Creative team roles.
              </p>
            </div>
          </div>
          {!asPage && (
            <button onClick={onClose} className="text-slate-400 hover:text-white font-bold text-lg">
              ✕
            </button>
          )}
        </div>

        {/* Current Active Logged-In User Banner */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={currentUser.avatar} alt={currentUser.name} className="w-10 h-10 rounded-full border-2 border-indigo-500 object-cover" />
            <div>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Logged In As</span>
              <h4 className="text-xs font-bold text-white">{currentUser.name} ({currentUser.role.toUpperCase()})</h4>
              <p className="text-[11px] text-slate-400">{currentUser.email}</p>
            </div>
          </div>

          {isAdmin ? (
            <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Full Admin Rights Granted</span>
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold">
              Role: {currentUser.role.toUpperCase()}
            </span>
          )}
        </div>

        {/* Main Content: Left Column Team Members, Right Column Privileges Checkboxes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Team Members List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Team Roster</span>
              {isAdmin && (
                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>Add Member</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              {users.map((u) => {
                const isSelected = u.id === activeInspectedUser.id;
                const isCurrentActive = u.id === currentUser.id;

                return (
                  <div
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-600/15 border-indigo-500/60 shadow-md'
                        : 'bg-slate-950 border-slate-800 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <img src={u.avatar} alt={u.name} className="w-7 h-7 rounded-full object-cover border border-slate-700" />
                        <div>
                          <h4 className="text-xs font-bold text-white truncate max-w-[120px]">{u.name}</h4>
                          <span className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${
                            u.role === 'admin' ? 'bg-indigo-500/20 text-indigo-300' :
                            u.role === 'manager' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {u.role}
                          </span>
                        </div>
                      </div>

                      {isCurrentActive && (
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">Active</span>
                      )}
                    </div>

                    <div className="mt-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectActiveUser(u);
                          showToast(`Switched active view session to ${u.name}`);
                        }}
                        className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] text-cyan-300 font-bold rounded-lg flex items-center justify-center gap-1 border border-slate-700 cursor-pointer"
                      >
                        <UserCheck className="w-3 h-3 text-cyan-400" />
                        <span>Switch User</span>
                      </button>

                      {deletingUserId === u.id ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTeamMember(u.id, u.name);
                          }}
                          className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] rounded-lg cursor-pointer"
                        >
                          Confirm
                        </button>
                      ) : (
                        (isAdmin || currentUser.privileges.can_add_team) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingUserId(u.id);
                            }}
                            className="p-1.5 bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-800 rounded-lg cursor-pointer transition-all"
                            title="Delete Team Member"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Granular Privilege Checkboxes for Inspected User */}
          <div className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-cyan-400" />
                  Assigned Privilege Checkboxes
                </h3>
                <p className="text-[11px] text-slate-400">
                  Editing access permissions for <span className="text-cyan-300 font-bold">{activeInspectedUser.name}</span>
                </p>
              </div>

              {!isAdmin && (
                <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 font-medium">
                  Read-Only Mode
                </span>
              )}
            </div>

            <div className="space-y-3">
              {privilegeDefinitions.map((priv) => {
                const isChecked = Boolean(activeInspectedUser.privileges[priv.key]);

                return (
                  <div
                    key={priv.key}
                    onClick={() => handleTogglePrivilege(activeInspectedUser.id, priv.key)}
                    className={`p-3 rounded-xl border flex items-start gap-3 transition-all ${
                      isAdmin ? 'cursor-pointer hover:border-indigo-500/50' : 'cursor-default'
                    } ${
                      isChecked
                        ? 'bg-slate-900 border-indigo-500/30'
                        : 'bg-slate-950 border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="pt-0.5">
                      {isChecked ? (
                        <CheckSquare className="w-5 h-5 text-indigo-400" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-600" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isChecked ? 'text-white' : 'text-slate-400'}`}>
                          {priv.label}
                        </span>
                        <code className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-indigo-300 border border-slate-800">
                          {priv.key}
                        </code>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{priv.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-800 pt-4">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg cursor-pointer"
          >
            Done & Apply Access Rights
          </button>
        </div>
      </div>

      {/* Add Team Member Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-cyan-400" />
                Add New Agency Team Member
              </h3>
              <button onClick={() => setShowAddUserModal(false)} className="text-slate-400 hover:text-white font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTeamMember} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Sarah Connor"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. sarah@growthos.ai"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Assigned Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold"
                >
                  <option value="admin">Admin (All Rights Enabled)</option>
                  <option value="manager">Manager (Account & Invoicing Enabled)</option>
                  <option value="creative">Creative (Calendar & Socials Enabled)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Department</label>
                <input
                  type="text"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg cursor-pointer"
                >
                  Add Team Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
