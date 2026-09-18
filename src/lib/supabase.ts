import { createClient, RealtimeChannel, Session, User } from '@supabase/supabase-js';
import {
  CalendarBriefPayload,
  CalendarCraftRole,
  CalendarShare,
  Campaign,
  ClientProfile,
  ContentCalendarItem,
  UserProfile,
  UserPrivileges,
  UserRole,
  WorkspacePreferences,
} from '../types';
import { MOCK_CAMPAIGN_DATA } from '../data/mockCampaigns';
import { INITIAL_MOCK_CALENDAR } from '../data/mockCalendar';
import { readJsonResponse } from './httpJson';
import { scheduledAtIso } from '../../shared/calendarPublish';
import { probeGoogleAuthEnabled } from '../../shared/googleAuth';
import { connectionsToPlatforms } from './liveApi';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

import { isProviderOAuthReturn } from './providerOAuthReturn';

const AUTH_CLIENT_OPTIONS = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Facebook returns ?code&state on /auth/callback. If that hits the SPA, exchanging it with
    // Supabase Auth 400s and can wipe the workspace session.
    detectSessionInUrl: typeof window === 'undefined' ? true : !isProviderOAuthReturn(),
  },
};

function hasValidSupabaseConfig(url?: string | null, key?: string | null): boolean {
  if (!url || !key) return false;
  if (url.includes('YOUR_PROJECT') || url.includes('placeholder.supabase.co')) return false;
  if (key.includes('YOUR_SUPABASE') || key === 'placeholder-key') return false;
  return true;
}

let runtimeSupabaseUrl: string | null = null;
let runtimeSupabaseAnonKey: string | null = null;
let runtimeGoogleAuthEnabled: boolean | null = null;
let bootstrapComplete = false;

export let supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  AUTH_CLIENT_OPTIONS
);

export function isSupabaseConfigured(): boolean {
  return (
    hasValidSupabaseConfig(supabaseUrl, supabaseAnonKey) ||
    hasValidSupabaseConfig(runtimeSupabaseUrl, runtimeSupabaseAnonKey)
  );
}

export function isGoogleAuthEnabled(): boolean {
  return runtimeGoogleAuthEnabled === true;
}

function activeSupabaseUrl(): string {
  return runtimeSupabaseUrl || supabaseUrl || '';
}

function activeSupabaseAnonKey(): string {
  return runtimeSupabaseAnonKey || supabaseAnonKey || '';
}

export async function refreshGoogleAuthEnabled(): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    runtimeGoogleAuthEnabled = false;
    return false;
  }
  runtimeGoogleAuthEnabled = await probeGoogleAuthEnabled(activeSupabaseUrl(), activeSupabaseAnonKey());
  return runtimeGoogleAuthEnabled;
}

/** Load Supabase URL/key from build env or /api/public-config (Vercel runtime). */
export async function bootstrapSupabaseConfig(): Promise<boolean> {
  if (bootstrapComplete && isSupabaseConfigured()) {
    if (runtimeGoogleAuthEnabled === null) {
      void refreshGoogleAuthEnabled();
    }
    return true;
  }

  if (hasValidSupabaseConfig(supabaseUrl, supabaseAnonKey)) {
    bootstrapComplete = true;
    void refreshGoogleAuthEnabled();
    return true;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('/api/public-config', { signal: controller.signal });
    clearTimeout(timeout);
    const parsed = await readJsonResponse<{
      configured?: boolean;
      supabaseUrl?: string;
      supabaseAnonKey?: string;
      googleAuthEnabled?: boolean;
    }>(res);
    if (parsed.ok === false) {
      console.error('Failed to load Supabase public config:', parsed.error);
      bootstrapComplete = true;
      return false;
    }
    const data = parsed.data;
    if (data.configured && hasValidSupabaseConfig(data.supabaseUrl, data.supabaseAnonKey)) {
      runtimeSupabaseUrl = data.supabaseUrl!;
      runtimeSupabaseAnonKey = data.supabaseAnonKey!;
      if (typeof data.googleAuthEnabled === 'boolean') {
        runtimeGoogleAuthEnabled = data.googleAuthEnabled;
      }
      supabase = createClient(data.supabaseUrl!, data.supabaseAnonKey!, AUTH_CLIENT_OPTIONS);
      bootstrapComplete = true;
      if (runtimeGoogleAuthEnabled === null) {
        void refreshGoogleAuthEnabled();
      }
      return true;
    }
  } catch (err) {
    console.error('Failed to load Supabase public config:', err);
  }

  bootstrapComplete = true;
  return false;
}

function asAuthError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(message)) {
    return new Error(
      'Cannot reach Supabase. Confirm the project is active, then set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel (or SUPABASE_URL + SUPABASE_ANON_KEY) and redeploy.'
    );
  }
  return err instanceof Error ? err : new Error(message);
}

export function getDefaultPrivileges(role: UserRole): UserPrivileges {
  if (role === 'super_admin' || role === 'admin') {
    return {
      can_create_account: true,
      can_delete_social_handle: true,
      can_add_team: true,
      can_invoice_management: true,
      can_manage_campaigns: true,
      can_manage_calendar: true,
      can_sync_social: true,
    };
  }
  if (role === 'manager') {
    return {
      can_create_account: false,
      can_delete_social_handle: false,
      can_add_team: false,
      can_invoice_management: true,
      can_manage_campaigns: true,
      can_manage_calendar: true,
      can_sync_social: true,
    };
  }
  return {
    can_create_account: false,
    can_delete_social_handle: false,
    can_add_team: false,
    can_invoice_management: false,
    can_manage_campaigns: true,
    can_manage_calendar: true,
    can_sync_social: false,
  };
}

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  phone: string | null;
  company_name: string | null;
  website: string | null;
  department: string | null;
  org_id: string | null;
  privileges: UserPrivileges;
  preferences: UserProfile['preferences'] | null;
  created_at: string;
};

type ClientRow = {
  id: string;
  name: string;
  industry: ClientProfile['industry'];
  industry_label: string;
  logo: string;
  website: string;
  tier: ClientProfile['tier'];
  monthly_budget: number;
  primary_goal: string;
  growth_score: number;
  virality_score: number;
  engagement_health: number;
  sentiment_score: number;
  conversion_score: number;
  roi_multiplier: number;
  platforms: ClientProfile['platforms'];
  next_payment_date: string;
  last_payment_date: string;
  payment_status: ClientProfile['paymentStatus'];
  outstanding_amount: number;
  invoices: ClientProfile['invoices'];
  recent_growth_trends: ClientProfile['recentGrowthTrends'];
};

type CampaignRow = {
  id: string;
  client_id: string;
  name: string;
  type: Campaign['type'];
  objective: Campaign['objective'];
  objective_label: string;
  status: Campaign['status'];
  primary_goal: string;
  primary_metric: string;
  budget: number;
  start_date: string;
  end_date: string;
  target_metric: string;
  current_progress: number;
  channels: Campaign['channels'];
  metrics: Campaign['metrics'];
  funnel_stages: Campaign['funnelStages'] | null;
  retargeting_pools: Campaign['retargetingPools'] | null;
  ai_notes: string | null;
};

type CalendarRow = {
  id: string;
  client_id: string;
  campaign_id: string | null;
  date: string;
  day_of_week: string;
  time: string;
  platform: ContentCalendarItem['platform'];
  content_type: ContentCalendarItem['contentType'];
  topic: string;
  hook_text: string;
  caption_text: string;
  cta: string;
  status: ContentCalendarItem['status'];
  ai_score: number;
  ai_feedback: string | null;
  ai_suggested_hook: string | null;
  ai_suggested_time: string | null;
  visual_asset_url: string | null;
  visual_asset_type: ContentCalendarItem['visualAssetType'] | null;
  designer_status: ContentCalendarItem['designerStatus'] | null;
  designer_notes: string | null;
  creative_analysis: ContentCalendarItem['creativeAnalysis'] | null;
  assignee_id: string | null;
  assignee_name: string | null;
  assignee_craft: string | null;
  scheduled_at?: string | null;
  published_at?: string | null;
  provider_post_id?: string | null;
  provider_permalink?: string | null;
  publish_error?: string | null;
  publish_blocked?: boolean | null;
};

function mapProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    name: row.name || 'Member',
    email: row.email,
    role: row.role,
    avatar: row.avatar,
    phone: row.phone || undefined,
    companyName: row.company_name || undefined,
    website: row.website || undefined,
    department: row.department || undefined,
    orgId: row.org_id || undefined,
    createdAt: row.created_at,
    privileges: row.privileges || getDefaultPrivileges(row.role),
    preferences: row.preferences || undefined,
  };
}

function mapClient(row: ClientRow): ClientProfile {
  return {
    id: row.id,
    name: row.name || 'Untitled brand',
    industry: row.industry,
    industryLabel: row.industry_label,
    logo: row.logo,
    website: row.website,
    tier: row.tier,
    monthlyBudget: Number(row.monthly_budget) || 0,
    primaryGoal: row.primary_goal,
    growthScore: Number(row.growth_score) || 0,
    viralityScore: Number(row.virality_score) || 0,
    engagementHealth: Number(row.engagement_health) || 0,
    sentimentScore: Number(row.sentiment_score) || 0,
    conversionScore: Number(row.conversion_score) || 0,
    roiMultiplier: Number(row.roi_multiplier) || 0,
    platforms: row.platforms || [],
    nextPaymentDate: row.next_payment_date,
    lastPaymentDate: row.last_payment_date,
    paymentStatus: row.payment_status,
    outstandingAmount: Number(row.outstanding_amount) || 0,
    invoices: row.invoices || [],
    recentGrowthTrends: row.recent_growth_trends || [],
  };
}

function mapCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    type: row.type,
    objective: row.objective,
    objectiveLabel: row.objective_label,
    status: row.status,
    primaryGoal: row.primary_goal,
    primaryMetric: row.primary_metric,
    budget: Number(row.budget) || 0,
    startDate: row.start_date,
    endDate: row.end_date,
    targetMetric: row.target_metric,
    currentProgress: Number(row.current_progress) || 0,
    channels: row.channels || [],
    metrics: row.metrics,
    funnelStages: row.funnel_stages || undefined,
    retargetingPools: row.retargeting_pools || undefined,
    aiNotes: row.ai_notes || undefined,
  };
}

function mapCalendarItem(row: CalendarRow): ContentCalendarItem {
  return {
    id: row.id,
    clientId: row.client_id,
    campaignId: row.campaign_id || undefined,
    date: row.date,
    dayOfWeek: row.day_of_week,
    time: row.time,
    platform: row.platform,
    contentType: row.content_type,
    topic: row.topic,
    hookText: row.hook_text,
    captionText: row.caption_text,
    cta: row.cta,
    status: row.status,
    aiScore: Number(row.ai_score) || 0,
    aiFeedback: row.ai_feedback || undefined,
    aiSuggestedHook: row.ai_suggested_hook || undefined,
    aiSuggestedTime: row.ai_suggested_time || undefined,
    visualAssetUrl: row.visual_asset_url || undefined,
    visualAssetType: row.visual_asset_type || undefined,
    designerStatus: row.designer_status || undefined,
    designerNotes: row.designer_notes || undefined,
    creativeAnalysis: row.creative_analysis || undefined,
    assigneeId: row.assignee_id || undefined,
    assigneeName: row.assignee_name || undefined,
    assigneeCraft: row.assignee_craft || undefined,
    scheduledAt: row.scheduled_at || undefined,
    publishedAt: row.published_at || undefined,
    providerPostId: row.provider_post_id || undefined,
    providerPermalink: row.provider_permalink || undefined,
    publishError: row.publish_error || undefined,
    publishBlocked: Boolean(row.publish_blocked),
  };
}

function clientToRow(client: ClientProfile, orgId?: string | null) {
  return {
    id: client.id,
    org_id: orgId ?? null,
    name: client.name,
    industry: client.industry,
    industry_label: client.industryLabel,
    logo: client.logo,
    website: client.website,
    tier: client.tier,
    monthly_budget: client.monthlyBudget,
    primary_goal: client.primaryGoal,
    growth_score: client.growthScore,
    virality_score: client.viralityScore,
    engagement_health: client.engagementHealth,
    sentiment_score: client.sentimentScore,
    conversion_score: client.conversionScore,
    roi_multiplier: client.roiMultiplier,
    platforms: client.platforms,
    next_payment_date: client.nextPaymentDate,
    last_payment_date: client.lastPaymentDate,
    payment_status: client.paymentStatus,
    outstanding_amount: client.outstandingAmount,
    invoices: client.invoices,
    recent_growth_trends: client.recentGrowthTrends,
  };
}

function campaignToRow(campaign: Campaign) {
  return {
    id: campaign.id,
    client_id: campaign.clientId,
    name: campaign.name,
    type: campaign.type,
    objective: campaign.objective,
    objective_label: campaign.objectiveLabel,
    status: campaign.status,
    primary_goal: campaign.primaryGoal,
    primary_metric: campaign.primaryMetric,
    budget: campaign.budget,
    start_date: campaign.startDate,
    end_date: campaign.endDate,
    target_metric: campaign.targetMetric,
    current_progress: campaign.currentProgress,
    channels: campaign.channels,
    metrics: campaign.metrics,
    funnel_stages: campaign.funnelStages ?? null,
    retargeting_pools: campaign.retargetingPools ?? null,
    ai_notes: campaign.aiNotes ?? null,
  };
}

function calendarToRow(item: ContentCalendarItem) {
  return {
    id: item.id,
    client_id: item.clientId,
    campaign_id: item.campaignId ?? null,
    date: item.date,
    day_of_week: item.dayOfWeek,
    time: item.time,
    platform: item.platform,
    content_type: item.contentType,
    topic: item.topic,
    hook_text: item.hookText,
    caption_text: item.captionText,
    cta: item.cta,
    status: item.status,
    ai_score: item.aiScore,
    ai_feedback: item.aiFeedback ?? null,
    ai_suggested_hook: item.aiSuggestedHook ?? null,
    ai_suggested_time: item.aiSuggestedTime ?? null,
    visual_asset_url: item.visualAssetUrl ?? null,
    visual_asset_type: item.visualAssetType ?? null,
    designer_status: item.designerStatus ?? null,
    designer_notes: item.designerNotes ?? null,
    creative_analysis: item.creativeAnalysis ?? null,
    assignee_id: item.assigneeId ?? null,
    assignee_name: item.assigneeName ?? null,
    assignee_craft: item.assigneeCraft ?? null,
    scheduled_at: item.scheduledAt || scheduledAtIso(item.date, item.time) || null,
  };
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('Failed to fetch profile:', error.message);
    return null;
  }
  return data ? mapProfile(data as ProfileRow) : null;
}

async function ensureProfileFromAuthUser(
  user: User,
  overrides: Partial<{
    name: string;
    phone: string;
    companyName: string;
    role: UserRole;
    avatar: string;
  }> = {}
): Promise<UserProfile> {
  const existing = await fetchProfile(user.id);
  if (existing) return existing;

  const email = user.email || '';
  const name =
    overrides.name ||
    (user.user_metadata?.name as string) ||
    (user.user_metadata?.full_name as string) ||
    email.split('@')[0] ||
    'GrowthOS Member';
  const role = (overrides.role ||
    (user.user_metadata?.role as UserRole) ||
    'admin') as UserRole;
  const avatar =
    overrides.avatar ||
    (user.user_metadata?.avatar_url as string) ||
    (user.user_metadata?.picture as string) ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=128`;

  const row = {
    id: user.id,
    name,
    email,
    role,
    avatar,
    phone: overrides.phone || null,
    company_name: overrides.companyName || null,
    department: 'Growth Operations',
    privileges: getDefaultPrivileges(role),
  };

  const { data, error } = await supabase
    .from('profiles')
    .upsert(row, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapProfile(data as ProfileRow);
}

async function ensureWorkspaceForProfile(
  profile: UserProfile,
  options?: { industry?: string; goals?: string[] }
): Promise<UserProfile> {
  if (profile.orgId) return profile;

  const orgId = await createOrganizationForUser(
    profile.id,
    profile.companyName || `${profile.name}'s Agency`
  );
  if (!orgId) return profile;

  const { count } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId);
  if ((count ?? 0) === 0) {
    await createStarterClientForOrg(orgId, {
      name: profile.companyName?.trim() || `${profile.name.split(' ')[0]}'s Brand`,
      industry: options?.industry,
      primaryGoal: goalTextFromWizard(options?.goals),
    });
  }

  return (await fetchProfile(profile.id)) || { ...profile, orgId };
}

// --- AUTH ---

export async function registerUser(
  email: string,
  pass: string,
  fullName: string,
  phone: string = '',
  companyName: string = '',
  role: UserRole = 'admin',
  avatarUrl?: string,
  options?: { industry?: string; goals?: string[] }
): Promise<UserProfile> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment, then reload.'
    );
  }

  const avatar =
    avatarUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=6366f1&color=fff&size=128`;

  let data;
  let error;
  try {
    console.info('[auth] registerUser signUp start');
    const signUp = supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: {
          name: fullName,
          full_name: fullName,
          phone,
          company_name: companyName,
          avatar,
          privileges: getDefaultPrivileges('admin'),
        },
      },
    });
    ({ data, error } = await Promise.race([
      signUp,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Registration timed out. Check your connection and try email sign-up again.')),
          20000
        )
      ),
    ]));
    console.info('[auth] registerUser signUp done', { hasUser: Boolean(data?.user), hasSession: Boolean(data?.session), error: error?.message });
  } catch (err) {
    console.warn('[auth] registerUser signUp failed', err);
    throw asAuthError(err);
  }

  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Registration succeeded but no user was returned.');

  if (!data.session) {
    throw new Error(
      'Check your email to confirm your account, then sign in. Your workspace will unlock after confirmation.'
    );
  }

  const profile = await ensureProfileFromAuthUser(data.user, {
    name: fullName,
    phone,
    companyName,
    role: 'admin',
    avatar,
  });

  await acceptPendingInviteForEmail(email, profile.id);
  const withOrg = await ensureWorkspaceForProfile(
    (await fetchProfile(profile.id)) || profile,
    options
  );

  const tourProfile = await saveWorkspacePreferences(withOrg.id, {
    preferences: {
      ...(withOrg.preferences || {}),
      featureTourSeen: false,
    },
  });

  return tourProfile;
}

export async function loginWithEmail(email: string, pass: string): Promise<UserProfile> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment, then reload.'
    );
  }

  let data;
  let error;
  try {
    ({ data, error } = await supabase.auth.signInWithPassword({ email, password: pass }));
  } catch (err) {
    throw asAuthError(err);
  }
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Login succeeded but no user was returned.');
  if (data.user.email) {
    await acceptPendingInviteForEmail(data.user.email, data.user.id);
  }
  const profile = await ensureProfileFromAuthUser(data.user);
  return ensureWorkspaceForProfile(profile);
}

export async function loginWithGoogle(): Promise<UserProfile> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment, then reload.'
    );
  }

  const googleOn = runtimeGoogleAuthEnabled === true || (await refreshGoogleAuthEnabled());
  if (!googleOn) {
    throw new Error('Google sign-in is not enabled on this workspace. Use your work email and password.');
  }

  let data;
  let error;
  try {
    ({ data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        skipBrowserRedirect: true,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    }));
  } catch (err) {
    throw asAuthError(err);
  }

  if (error) throw new Error(error.message);
  if (!data.url) {
    throw new Error('Google sign-in is not available. Use your work email and password.');
  }

  window.location.assign(data.url);
  throw new Error('Redirecting to Google sign-in…');
}

export async function resetPasswordForEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/?recovery=1`,
  });
  if (error) throw new Error(error.message);
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

export function isPasswordRecoveryRedirect(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('recovery') === '1') return true;
  const hash = window.location.hash || '';
  return hash.includes('type=recovery');
}

export async function logoutUser(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function createOrganizationForUser(userId: string, name: string, website?: string) {
  const { data: orgId, error } = await supabase.rpc('create_organization_for_current_user', {
    org_name: name,
    org_website: website || null,
  });
  if (error || !orgId) {
    console.warn('Org create skipped:', error?.message);
    return null;
  }
  if (typeof orgId === 'string') return orgId;
  return String(orgId);
}

export async function inviteTeamMember(input: {
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  privileges?: UserPrivileges;
  invitedBy: string;
  orgId?: string;
}): Promise<void> {
  const privileges = input.privileges || getDefaultPrivileges(input.role);
  const email = input.email.trim().toLowerCase();
  await supabase.from('team_invites').delete().eq('email', email).eq('status', 'pending');
  const { error } = await supabase.from('team_invites').insert({
    email,
    name: input.name.trim(),
    role: input.role,
    department: input.department || 'Growth Operations',
    privileges,
    invited_by: input.invitedBy,
    org_id: input.orgId || null,
    status: 'pending',
  });
  if (error) throw new Error(error.message);
  // Invite is applied on signup/login via acceptPendingInviteForEmail.
}

export async function acceptPendingInviteForEmail(email: string, userId: string) {
  const normalized = email.trim().toLowerCase();
  const { data: invite } = await supabase
    .from('team_invites')
    .select('*')
    .eq('email', normalized)
    .eq('status', 'pending')
    .maybeSingle();

  if (!invite) return;

  await supabase
    .from('profiles')
    .update({
      name: invite.name || undefined,
      role: invite.role,
      department: invite.department,
      privileges: invite.privileges,
      org_id: invite.org_id,
    })
    .eq('id', userId);

  await supabase.from('team_invites').update({ status: 'accepted' }).eq('id', invite.id);
}

export async function deleteProfile(userId: string): Promise<void> {
  const { error } = await supabase.from('profiles').delete().eq('id', userId);
  if (error) throw new Error(error.message);
}

export async function saveWorkspacePreferences(
  userId: string,
  patch: {
    companyName?: string;
    website?: string;
    preferences?: WorkspacePreferences;
  }
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      company_name: patch.companyName ?? undefined,
      website: patch.website ?? undefined,
      preferences: patch.preferences ?? undefined,
    })
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return mapProfile(data as ProfileRow);
}

export function subscribeToAuthState(
  onUserChanged: (userProfile: UserProfile | null) => void,
  onRecovery?: () => void
): () => void {
  let active = true;

  const resolve = async (session: Session | null, event?: string) => {
    if (!active) return;
    if (event === 'PASSWORD_RECOVERY' || isPasswordRecoveryRedirect()) {
      onRecovery?.();
    }
    if (!session?.user) {
      onUserChanged(null);
      return;
    }
    try {
      if (session.user.email) {
        await acceptPendingInviteForEmail(session.user.email, session.user.id);
      }
      const profile = await ensureWorkspaceForProfile(
        await ensureProfileFromAuthUser(session.user)
      );
      if (active) onUserChanged(profile);
    } catch (err) {
      console.warn('Error resolving auth profile:', err);
      if (active) onUserChanged(null);
    }
  };

  const sessionWatchdog = window.setTimeout(() => {
    if (!active) return;
    console.warn('Supabase getSession timed out; waiting for auth state');
  }, 8000);

  supabase.auth
    .getSession()
    .then(({ data }) => {
      window.clearTimeout(sessionWatchdog);
      return resolve(data.session);
    })
    .catch((err) => {
      window.clearTimeout(sessionWatchdog);
      console.warn('Supabase getSession failed:', err);
    });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    void resolve(session, event);
  });

  return () => {
    active = false;
    window.clearTimeout(sessionWatchdog);
    subscription.unsubscribe();
  };
}

// --- SEED (dev/demo only — not called in production app flow) ---

const INDUSTRY_LABELS: Record<string, string> = {
  saas: 'SaaS / Tech',
  fmcg: 'FMCG & Consumer Goods',
  education: 'Education',
  healthcare: 'Healthcare & Wellness',
  hospitality: 'Hospitality',
  realestate: 'Real Estate',
  sme: 'Local SME',
  politics: 'Politics & Public Affairs',
};

function goalTextFromWizard(goals?: string[]): string {
  const map: Record<string, string> = {
    lead_gen: 'Lead generation',
    viral_reach: 'Reach & awareness',
    sales: 'Sales conversion',
    automation: 'Team automation',
  };
  if (!goals?.length) return 'Grow audience and generate qualified leads';
  return goals.map((g) => map[g] || g).join(' · ');
}

export async function createStarterClientForOrg(
  orgId: string,
  input: { name: string; industry?: string; primaryGoal?: string }
): Promise<ClientProfile> {
  const industry = (input.industry || 'sme') as ClientProfile['industry'];
  const name = input.name.trim() || 'My First Brand';
  const client: ClientProfile = {
    id: `client-${crypto.randomUUID()}`,
    name,
    industry,
    industryLabel: INDUSTRY_LABELS[industry] || 'Local SME',
    logo: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=128`,
    website: '',
    tier: 'Starter',
    monthlyBudget: 0,
    primaryGoal: input.primaryGoal || 'Grow audience and generate qualified leads',
    growthScore: 0,
    viralityScore: 0,
    engagementHealth: 0,
    sentimentScore: 0,
    conversionScore: 0,
    roiMultiplier: 0,
    platforms: [],
    nextPaymentDate: '',
    lastPaymentDate: '',
    paymentStatus: 'outstanding',
    outstandingAmount: 0,
    invoices: [],
    recentGrowthTrends: [],
  };

  const { error } = await supabase.from('clients').insert({
    ...clientToRow(client, orgId),
  });
  if (error) throw new Error(error.message);
  return client;
}

/** @deprecated Global demo seed — kept for local dev scripts only. */
export async function seedDatabaseIfEmpty(
  initialClients: ClientProfile[],
  _initialUsers: UserProfile[]
) {
  try {
    const { count: clientCount, error: clientCountError } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true });

    if (clientCountError) {
      console.warn('Supabase seed check failed (non-blocking):', clientCountError.message);
      return;
    }

    if ((clientCount ?? 0) === 0 && initialClients.length > 0) {
      console.log('Seeding initial client data into Supabase...');
      const { error } = await supabase.from('clients').upsert(initialClients.map((c) => clientToRow(c)));
      if (error) console.warn('Client seed error:', error.message);
    }

    const { count: campaignCount } = await supabase
      .from('campaigns')
      .select('id', { count: 'exact', head: true });

    if ((campaignCount ?? 0) === 0) {
      console.log('Seeding initial campaign data into Supabase...');
      const allCampaigns = Object.values(MOCK_CAMPAIGN_DATA).flat();
      const { error } = await supabase.from('campaigns').upsert(allCampaigns.map(campaignToRow));
      if (error) console.warn('Campaign seed error:', error.message);
    }

    const { count: calendarCount } = await supabase
      .from('calendar_items')
      .select('id', { count: 'exact', head: true });

    if ((calendarCount ?? 0) === 0) {
      console.log('Seeding initial calendar data into Supabase...');
      const { error } = await supabase
        .from('calendar_items')
        .upsert(INITIAL_MOCK_CALENDAR.map(calendarToRow));
      if (error) console.warn('Calendar seed error:', error.message);
    }
  } catch (err) {
    console.warn('Supabase seeding check encountered an issue (non-blocking):', err);
  }
}

// --- REALTIME / CRUD ---

export function subscribeToClients(onUpdate: (clients: ClientProfile[]) => void): () => void {
  let channel: RealtimeChannel | null = null;

  const load = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      onUpdate([]);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.org_id) {
      onUpdate([]);
      return;
    }

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('org_id', profile.org_id)
      .order('name');
    if (error) {
      console.warn('Error loading clients:', error.message);
      onUpdate([]);
      return;
    }
    const { data: connections, error: connError } = await supabase
      .from('social_connections')
      .select(
        'id, client_id, platform, status, account_name, followers, growth_rate, last_sync, health_score, last_error, demographics'
      )
      .eq('org_id', profile.org_id);
    if (connError) console.warn('[clients] social_connections hydrate failed', connError.message);
    const byClient = new Map<string, any[]>();
    for (const row of connections || []) {
      const key = String(row.client_id || '');
      const list = byClient.get(key) || [];
      list.push(row);
      byClient.set(key, list);
    }
    const mapped = (data as ClientRow[] | null)?.map((row) => {
      const client = mapClient(row);
      const livePlatforms = connectionsToPlatforms(byClient.get(String(row.id)) || []);
      if (livePlatforms.length) {
        console.info('[clients] hydrate platforms from connections', {
          clientId: row.id,
          storedPlatforms: Array.isArray(row.platforms) ? row.platforms.length : 0,
          connectionCount: livePlatforms.length,
        });
        return { ...client, platforms: livePlatforms };
      }
      return client;
    }) || [];
    onUpdate(mapped);
  };

  void load();

  channel = supabase
    .channel('clients-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
      void load();
    })
    .subscribe();

  return () => {
    if (channel) void supabase.removeChannel(channel);
  };
}

export function subscribeToUsers(onUpdate: (users: UserProfile[]) => void): () => void {
  let channel: RealtimeChannel | null = null;

  const load = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      onUpdate([]);
      return;
    }

    const { data: selfProfile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!selfProfile?.org_id) {
      onUpdate([]);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('org_id', selfProfile.org_id)
      .order('name');
    if (error) {
      console.warn('Error loading profiles:', error.message);
      return;
    }
    if (data && data.length > 0) {
      onUpdate((data as ProfileRow[]).map(mapProfile));
    }
  };

  void load();

  channel = supabase
    .channel('profiles-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
      void load();
    })
    .subscribe();

  return () => {
    if (channel) void supabase.removeChannel(channel);
  };
}

export async function saveClient(client: ClientProfile, orgId?: string | null) {
  const resolvedOrgId = orgId ?? null;
  if (!resolvedOrgId) {
    throw new Error('Cannot save client without an organization. Complete onboarding first.');
  }
  const { error } = await supabase
    .from('clients')
    .upsert(clientToRow(client, resolvedOrgId), { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

export async function saveUser(user: UserProfile) {
  const { error } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      phone: user.phone ?? null,
      company_name: user.companyName ?? null,
      website: user.website ?? null,
      department: user.department ?? null,
      org_id: user.orgId ?? null,
      privileges: user.privileges,
      preferences: user.preferences ?? {},
    },
    { onConflict: 'id' }
  );
  if (error) throw new Error(error.message);
}

export function subscribeToCampaigns(
  clientId: string,
  onUpdate: (campaigns: Campaign[]) => void
): () => void {
  let channel: RealtimeChannel | null = null;

  const load = async () => {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', clientId)
      .order('name');
    if (error) {
      console.warn('Error loading campaigns:', error.message);
      onUpdate([]);
      return;
    }
    onUpdate((data as CampaignRow[] | null)?.map(mapCampaign) || []);
  };

  void load();

  channel = supabase
    .channel(`campaigns-${clientId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'campaigns', filter: `client_id=eq.${clientId}` },
      () => {
        void load();
      }
    )
    .subscribe();

  return () => {
    if (channel) void supabase.removeChannel(channel);
  };
}

export async function saveCampaign(campaign: Campaign) {
  const { error } = await supabase
    .from('campaigns')
    .upsert(campaignToRow(campaign), { onConflict: 'id' });
  if (error) {
    console.error('Failed to save campaign:', error.message);
    throw error;
  }
}

export async function deleteCampaign(campaignId: string) {
  const { error } = await supabase.from('campaigns').delete().eq('id', campaignId);
  if (error) {
    console.error('Failed to delete campaign:', error.message);
    throw error;
  }
}

export function subscribeToCalendarItems(
  clientId: string,
  onUpdate: (items: ContentCalendarItem[]) => void
): () => void {
  let channel: RealtimeChannel | null = null;

  const load = async () => {
    const { data, error } = await supabase
      .from('calendar_items')
      .select('*')
      .eq('client_id', clientId);
    if (error) {
      console.warn('Error loading calendar items:', error.message);
      onUpdate([]);
      return;
    }
    const items = ((data as CalendarRow[] | null) || [])
      .map(mapCalendarItem)
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    onUpdate(items);
  };

  void load();

  channel = supabase
    .channel(`calendar-${clientId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'calendar_items', filter: `client_id=eq.${clientId}` },
      () => {
        void load();
      }
    )
    .subscribe();

  return () => {
    if (channel) void supabase.removeChannel(channel);
  };
}

export async function saveCalendarItem(item: ContentCalendarItem) {
  const { error } = await supabase
    .from('calendar_items')
    .upsert(calendarToRow(item), { onConflict: 'id' });
  if (error) {
    console.error('Failed to save calendar item:', error.message);
    throw error;
  }
}

export async function deleteCalendarItem(itemId: string) {
  const { error } = await supabase.from('calendar_items').delete().eq('id', itemId);
  if (error) {
    console.error('Failed to delete calendar item:', error.message);
    throw error;
  }
}

export async function saveCalendarItems(items: ContentCalendarItem[]) {
  const { error } = await supabase
    .from('calendar_items')
    .upsert(items.map(calendarToRow), { onConflict: 'id' });
  if (error) {
    console.error('Failed to save calendar items:', error.message);
    throw error;
  }
}

function randomShareToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `brief${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
}

export async function listCalendarShares(clientId: string): Promise<CalendarShare[]> {
  const { data, error } = await supabase
    .from('calendar_shares')
    .select('*, calendar_share_members(*)')
    .eq('client_id', clientId)
    .eq('revoked', false)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  return ((data as any[]) || []).map((row) => ({
    id: row.id,
    clientId: row.client_id,
    orgId: row.org_id || undefined,
    token: row.token,
    label: row.label,
    accessMode: row.access_mode,
    createdBy: row.created_by || undefined,
    revoked: row.revoked,
    expiresAt: row.expires_at || undefined,
    createdAt: row.created_at,
    members: ((row.calendar_share_members as any[]) || []).map((m) => ({
      id: m.id,
      userId: m.user_id || undefined,
      email: m.email || undefined,
      craftRole: m.craft_role,
    })),
  }));
}

export async function createOrUpdateCalendarShare(input: {
  clientId: string;
  orgId?: string;
  createdBy: string;
  label?: string;
  accessMode?: 'read_only' | 'collaborate';
  members: Array<{ userId?: string; email?: string; craftRole: CalendarCraftRole | string; name?: string }>;
  existingShareId?: string;
}): Promise<CalendarShare> {
  let shareId = input.existingShareId;
  let token = '';

  if (shareId) {
    const { data: existing, error } = await supabase
      .from('calendar_shares')
      .update({
        label: input.label || 'Content calendar brief',
        access_mode: input.accessMode || 'read_only',
        updated_at: new Date().toISOString(),
        revoked: false,
      })
      .eq('id', shareId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    token = existing.token;
  } else {
    token = randomShareToken();
    const { data, error } = await supabase
      .from('calendar_shares')
      .insert({
        client_id: input.clientId,
        org_id: input.orgId || null,
        token,
        label: input.label || 'Content calendar brief',
        access_mode: input.accessMode || 'read_only',
        created_by: input.createdBy,
        revoked: false,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    shareId = data.id as string;
  }

  await supabase.from('calendar_share_members').delete().eq('share_id', shareId);

  if (input.members.length) {
    const { error: memberError } = await supabase.from('calendar_share_members').insert(
      input.members.map((m) => ({
        share_id: shareId,
        user_id: m.userId || null,
        email: m.email || null,
        craft_role: m.craftRole || 'collaborator',
      }))
    );
    if (memberError) throw new Error(memberError.message);
  }

  const shares = await listCalendarShares(input.clientId);
  const found = shares.find((s) => s.id === shareId);
  if (!found) {
    return {
      id: shareId!,
      clientId: input.clientId,
      orgId: input.orgId,
      token,
      label: input.label || 'Content calendar brief',
      accessMode: input.accessMode || 'read_only',
      createdBy: input.createdBy,
      revoked: false,
      members: input.members.map((m) => ({
        userId: m.userId,
        email: m.email,
        craftRole: m.craftRole,
        name: m.name,
      })),
    };
  }
  return found;
}

export async function revokeCalendarShare(shareId: string): Promise<void> {
  const { error } = await supabase
    .from('calendar_shares')
    .update({ revoked: true, updated_at: new Date().toISOString() })
    .eq('id', shareId);
  if (error) throw new Error(error.message);
}

export async function fetchCalendarBrief(token: string): Promise<CalendarBriefPayload> {
  const { data, error } = await supabase.rpc('get_calendar_brief', { share_token: token });
  if (error) throw new Error(error.message);
  const payload = data as CalendarBriefPayload & { error?: string };
  if (!payload || payload.error || !payload.client || !payload.share) {
    throw new Error('This calendar brief link is invalid or has been revoked.');
  }
  return payload;
}

export function calendarBriefUrl(token: string): string {
  return `${window.location.origin}/?brief=${encodeURIComponent(token)}`;
}

// Back-compat aliases used during Firebase → Supabase cutover
export const registerUserWithFirebase = registerUser;
export const loginUserWithFirebase = loginWithEmail;
export const logoutFirebase = logoutUser;
export const seedFirestoreIfEmpty = seedDatabaseIfEmpty;
export const saveUserToFirestore = saveUser;
export const saveClientToFirestore = saveClient;
export const saveCampaignToFirestore = saveCampaign;
export const deleteCampaignFromFirestore = deleteCampaign;
export const saveCalendarItemToFirestore = saveCalendarItem;
export const deleteCalendarItemFromFirestore = deleteCalendarItem;
export const saveCalendarItemsToFirestore = saveCalendarItems;
