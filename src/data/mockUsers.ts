import { UserProfile, UserPrivileges } from '../types';

export const DEFAULT_ROLE_PRIVILEGES: Record<string, UserPrivileges> = {
  admin: {
    can_create_account: true,
    can_delete_social_handle: true,
    can_add_team: true,
    can_invoice_management: true,
    can_manage_campaigns: true,
    can_manage_calendar: true,
    can_sync_social: true,
  },
  manager: {
    can_create_account: true,
    can_delete_social_handle: false,
    can_add_team: false,
    can_invoice_management: true,
    can_manage_campaigns: true,
    can_manage_calendar: true,
    can_sync_social: true,
  },
  creative: {
    can_create_account: false,
    can_delete_social_handle: false,
    can_add_team: false,
    can_invoice_management: false,
    can_manage_campaigns: false,
    can_manage_calendar: true,
    can_sync_social: true,
  },
};

export const MOCK_USERS: UserProfile[] = [
  {
    id: 'user-admin',
    name: 'Alex Rivera (Admin)',
    email: 'alex.rivera@growthos.ai',
    role: 'admin',
    department: 'Executive Operations',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    privileges: { ...DEFAULT_ROLE_PRIVILEGES.admin },
  },
  {
    id: 'user-manager',
    name: 'Maya Lin (Manager)',
    email: 'maya.lin@growthos.ai',
    role: 'manager',
    department: 'Client Growth & Accounts',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    privileges: { ...DEFAULT_ROLE_PRIVILEGES.manager },
  },
  {
    id: 'user-creative',
    name: 'Chris Vance (Creative)',
    email: 'chris.vance@growthos.ai',
    role: 'creative',
    department: 'Content & Design Engine',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    privileges: { ...DEFAULT_ROLE_PRIVILEGES.creative },
  },
];
