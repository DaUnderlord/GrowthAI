export type CurrencyCode = 'NGN' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'ZAR';

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'creative' | 'client';

export interface UserPrivileges {
  can_create_account: boolean;
  can_delete_social_handle: boolean;
  can_add_team: boolean;
  can_invoice_management: boolean;
  can_manage_campaigns: boolean;
  can_manage_calendar: boolean;
  can_sync_social: boolean;
}

export interface WorkspacePreferences {
  website?: string;
  emailAlerts?: boolean;
  weeklyDigest?: boolean;
  language?: string;
  timeZone?: string;
  twoFactorEnabled?: boolean;
  aiAutopilot?: boolean;
  currency?: CurrencyCode;
  whiteLabelMode?: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  phone?: string;
  companyName?: string;
  website?: string;
  createdAt?: string;
  department?: string;
  orgId?: string;
  privileges: UserPrivileges;
  preferences?: WorkspacePreferences;
}

export interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  amount: number;
  currency: CurrencyCode;
  date: string;
  dueDate: string;
  status: 'paid' | 'outstanding' | 'overdue';
  description: string;
  paidAt?: string;
}

export type IndustryCategory = 
  | 'fmcg'
  | 'education'
  | 'politics'
  | 'healthcare'
  | 'hospitality'
  | 'realestate'
  | 'sme';

export type PlatformType = 
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'linkedin'
  | 'youtube'
  | 'google_analytics'
  | 'whatsapp'
  | 'meta_ads'
  | 'google_ads';

export interface ConnectedPlatform {
  id: PlatformType;
  name: string;
  icon: string;
  connected: boolean;
  accountName: string;
  followers: number;
  growthRate: number;
  lastSync: string;
  healthScore: number;
  apiStatus?: 'live' | 'syncing' | 'offline' | 'needs_auth';
  rateLimitQuota?: string;
  oauthTokenMasked?: string;
  livePingMs?: number;
}

export interface ClientProfile {
  id: string;
  name: string;
  industry: IndustryCategory;
  industryLabel: string;
  logo: string;
  website: string;
  tier: 'Starter' | 'Agency Growth' | 'Enterprise White-Label';
  monthlyBudget: number;
  primaryGoal: string;
  growthScore: number;
  viralityScore: number;
  engagementHealth: number;
  sentimentScore: number;
  conversionScore: number;
  roiMultiplier: number;
  platforms: ConnectedPlatform[];

  // Payment & Invoice Tracking Fields
  nextPaymentDate: string;
  lastPaymentDate: string;
  paymentStatus: 'paid' | 'outstanding' | 'overdue';
  outstandingAmount: number;
  invoices: InvoiceItem[];

  recentGrowthTrends: {
    month: string;
    reach: number;
    engagement: number;
    leads: number;
    conversions: number;
    revenue: number;
  }[];
}

export interface AgentPersona {
  id: string;
  name: string;
  role: string;
  avatar: string;
  specialty: string;
  status: 'idle' | 'analyzing' | 'generating' | 'executing';
  lastInsight: string;
}

export interface PostPerformance {
  id: string;
  title: string;
  platform: PlatformType;
  postType: 'Reel' | 'Carousel' | 'Story' | 'Article' | 'Ad Campaign';
  postDate: string;
  reach: number;
  impressions: number;
  saves: number;
  shares: number;
  likes: number;
  comments: number;
  clicks: number;
  conversions: number;
  viralityScore: number;
  status: 'viral' | 'performing' | 'underperforming' | 'decaying';
  reboostRecommended: boolean;
  hookText: string;
}

export interface AudiencePersona {
  id: string;
  name: string;
  segmentName: string;
  percentage: number;
  ageRange: string;
  activeHours: string;
  interests: string[];
  buyingTriggers: string[];
  preferredFormat: string;
  sentimentScore: number;
  purchasingPower: 'High' | 'Medium' | 'Emerging';
}

export interface CompetitorBenchmark {
  id: string;
  name: string;
  followers: number;
  growthRatePct: number;
  engagementRatePct: number;
  topPostingTime: string;
  dominantFormat: string;
  contentGaps: string[];
  shareOfVoice: number;
  threatLevel: 'High' | 'Medium' | 'Low';
}

export interface ConversionPath {
  id: string;
  contentTitle: string;
  channel: PlatformType;
  touchpoints: {
    stage: 'Content Impression' | 'Engagement/Save' | 'Link Click' | 'Lead Form' | 'Sale Completed';
    count: number;
    conversionRatePct: number;
  }[];
  totalRevenueGenerated: number;
  cac: number;
  roas: number;
}

export interface PredictionResult {
  estimatedReach: string;
  viralityScore: number;
  engagementScore: number;
  conversionProbability: string;
  optimalPostingTime: string;
  confidenceScore: number;
  reasoning: string;
  recommendedTweaks: string[];
}

export interface BlueprintSection {
  id: string;
  title: string;
  subtitle: string;
  iconName: string;
  content: string | Record<string, any>;
}

export type CampaignType =
  | 'follower_growth'
  | 'sales_conversion'
  | 'retargeting'
  | 'brand_awareness'
  | 'lead_generation';

export type CampaignObjective =
  | 'followers'
  | 'lead_generation'
  | 'sales'
  | 'awareness'
  | 'retention';

export interface FunnelStageData {
  stageName: string;
  count: number;
  conversionRate: number;
  dropoffRate: number;
  description: string;
}

export interface RetargetingAudiencePool {
  id: string;
  name: string;
  triggerEvent: string;
  size: number;
  status: 'active' | 'warming' | 'ready';
  recommendedAdScript: string;
  recommendedDmSequence: string;
  activated?: boolean;
}

export interface Campaign {
  id: string;
  clientId: string;
  name: string;
  type: CampaignType;
  objective: CampaignObjective;
  objectiveLabel: string;
  status: 'active' | 'paused' | 'draft' | 'completed';
  primaryGoal: string;
  primaryMetric: string;
  budget: number;
  startDate: string;
  endDate: string;
  targetMetric: string;
  currentProgress: number; // e.g. 78%
  channels: PlatformType[];
  metrics: {
    impressions: number;
    engagements: number;
    clicks: number;
    leads: number;
    conversions: number;
    revenueGenerated: number;
    cvr: number;
    cac: number;
    roas: number;
  };
  funnelStages?: FunnelStageData[];
  retargetingPools?: RetargetingAudiencePool[];
  aiNotes?: string;
}

export type CalendarCraftRole =
  | 'designer'
  | 'video_editor'
  | 'social_marketer'
  | 'copywriter'
  | 'strategist'
  | 'collaborator';

export interface ContentCalendarItem {
  id: string;
  clientId: string;
  date: string; // e.g. "2026-08-01"
  dayOfWeek: string; // "Monday"
  time: string; // "19:30"
  platform: PlatformType;
  contentType: 'Reel' | 'Carousel' | 'Story' | 'Article' | 'Ad Campaign' | 'Shorts';
  topic: string;
  hookText: string;
  captionText: string;
  cta: string;
  campaignId?: string;
  status: 'scheduled' | 'draft' | 'published' | 'needs_correction';
  aiScore: number;
  aiFeedback?: string;
  aiSuggestedHook?: string;
  aiSuggestedTime?: string;
  assigneeId?: string;
  assigneeName?: string;
  assigneeCraft?: CalendarCraftRole | string;

  // Designer & Multimodal Analysis Additions
  visualAssetUrl?: string;
  visualAssetType?: 'image' | 'video';
  designerStatus?: 'in_brief' | 'designing' | 'asset_uploaded' | 'approved';
  designerNotes?: string;
  creativeAnalysis?: {
    visualScore: number;
    campaignGoalMatchPct: number;
    predictedSuccessRate: number;
    visualHookAudit: string;
    designTweaks: string[];
    relevanceAnalysis: string;
    analyzedAt: string;
  };
}

export interface CalendarShare {
  id: string;
  clientId: string;
  orgId?: string;
  token: string;
  label: string;
  accessMode: 'read_only' | 'collaborate';
  createdBy?: string;
  revoked: boolean;
  expiresAt?: string;
  createdAt?: string;
  members: CalendarShareMember[];
}

export interface CalendarShareMember {
  id?: string;
  userId?: string;
  email?: string;
  craftRole: CalendarCraftRole | string;
  name?: string;
}

export interface CalendarBriefPayload {
  share: {
    id: string;
    clientId: string;
    label: string;
    accessMode: 'read_only' | 'collaborate';
  };
  client: {
    id: string;
    name: string;
    logo?: string;
    primaryGoal?: string;
  };
  members: Array<{
    userId?: string;
    email?: string;
    craftRole: string;
  }>;
  items: Array<{
    id: string;
    date: string;
    dayOfWeek: string;
    time: string;
    platform: string;
    contentType: string;
    topic: string;
    hookText: string;
    captionText: string;
    cta: string;
    status: string;
    assigneeName?: string;
    assigneeCraft?: string;
    designerStatus?: string;
    designerNotes?: string;
  }>;
}

export interface CalendarAuditReport {
  overallScore: number;
  pillarBalance: {
    educationalPct: number;
    promotionalPct: number;
    engagementPct: number;
    socialProofPct: number;
  };
  strengths: string[];
  gapsAndWeaknesses: string[];
  postingTimeOptimization: string;
  campaignAlignmentScore: number;
  suggestedCorrectionsCount: number;
}

export type LeadStage =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'quote'
  | 'negotiation'
  | 'won'
  | 'lost';

export type ConversationChannel = 'whatsapp' | 'instagram' | 'facebook' | 'website' | 'email';

export interface WhatsAppAccount {
  id: string;
  orgId: string;
  clientId: string;
  phoneNumberId: string;
  wabaId?: string;
  displayPhoneNumber: string;
  verifiedName?: string;
  status: 'connected' | 'disconnected' | 'pending' | 'error';
  webhookSubscribed: boolean;
  createdAt?: string;
}

export interface CrmContact {
  id: string;
  orgId: string;
  clientId?: string;
  name: string;
  phone: string;
  whatsappId?: string;
  profileImageUrl?: string;
  source?: string;
  firstCampaignId?: string;
  lastCampaignId?: string;
  metaReferral?: Record<string, unknown>;
  tags?: string[];
  notes?: string;
  lastInteractionAt?: string;
}

export interface CrmConversation {
  id: string;
  orgId: string;
  clientId: string;
  contactId: string;
  whatsappAccountId?: string;
  channel: ConversationChannel;
  status: 'open' | 'pending' | 'closed' | 'archived';
  assignedTo?: string;
  campaignId?: string;
  leadStatus: LeadStage;
  leadScore: number;
  leadValue?: number;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  priority: string;
  tags?: string[];
  notes?: string;
  metaAttribution?: Record<string, unknown>;
  aiSummary?: string;
  recommendedAction?: string;
  contact?: CrmContact;
}

export interface CrmMessage {
  id: string;
  orgId: string;
  conversationId: string;
  direction: 'incoming' | 'outgoing';
  type: string;
  text?: string;
  mediaUrl?: string;
  status: 'received' | 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  senderType: string;
  senderUserId?: string;
  whatsappMessageId?: string;
  errorMessage?: string;
  timestamp: string;
}

