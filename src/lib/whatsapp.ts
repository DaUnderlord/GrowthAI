import { RealtimeChannel } from '@supabase/supabase-js';
import {
  CrmContact,
  CrmConversation,
  CrmMessage,
  LeadStage,
  WhatsAppAccount,
} from '../types';
import { supabase } from './supabase';

function mapAccount(row: any): WhatsAppAccount {
  return {
    id: row.id,
    orgId: row.org_id,
    clientId: row.client_id,
    phoneNumberId: row.phone_number_id,
    wabaId: row.waba_id || undefined,
    displayPhoneNumber: row.display_phone_number || '',
    verifiedName: row.verified_name || undefined,
    status: row.status,
    webhookSubscribed: Boolean(row.webhook_subscribed),
    createdAt: row.created_at,
  };
}

function mapContact(row: any): CrmContact {
  return {
    id: row.id,
    orgId: row.org_id,
    clientId: row.client_id || undefined,
    name: row.name || row.phone,
    phone: row.phone,
    whatsappId: row.whatsapp_id || undefined,
    profileImageUrl: row.profile_image_url || undefined,
    source: row.source || undefined,
    firstCampaignId: row.first_campaign_id || undefined,
    lastCampaignId: row.last_campaign_id || undefined,
    metaReferral: row.meta_referral || {},
    tags: row.tags || [],
    notes: row.notes || undefined,
    lastInteractionAt: row.last_interaction_at,
  };
}

function mapConversation(row: any): CrmConversation {
  const contactRow = row.contacts || row.contact;
  return {
    id: row.id,
    orgId: row.org_id,
    clientId: row.client_id,
    contactId: row.contact_id,
    whatsappAccountId: row.whatsapp_account_id || undefined,
    channel: row.channel,
    status: row.status,
    assignedTo: row.assigned_to || undefined,
    campaignId: row.campaign_id || undefined,
    leadStatus: row.lead_status,
    leadScore: Number(row.lead_score) || 0,
    leadValue: row.lead_value != null ? Number(row.lead_value) : undefined,
    lastMessage: row.last_message || undefined,
    lastMessageAt: row.last_message_at || undefined,
    unreadCount: Number(row.unread_count) || 0,
    priority: row.priority || 'normal',
    tags: row.tags || [],
    notes: row.notes || undefined,
    metaAttribution: row.meta_attribution || {},
    aiSummary: row.ai_summary || undefined,
    recommendedAction: row.recommended_action || undefined,
    contact: contactRow ? mapContact(contactRow) : undefined,
  };
}

function mapMessage(row: any): CrmMessage {
  return {
    id: row.id,
    orgId: row.org_id,
    conversationId: row.conversation_id,
    direction: row.direction,
    type: row.type,
    text: row.text || undefined,
    mediaUrl: row.media_url || undefined,
    status: row.status,
    senderType: row.sender_type,
    senderUserId: row.sender_user_id || undefined,
    whatsappMessageId: row.whatsapp_message_id || undefined,
    errorMessage: row.error_message || undefined,
    timestamp: row.timestamp || row.created_at,
  };
}

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in required for WhatsApp actions.');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function fetchWhatsAppAccounts(): Promise<{
  accounts: WhatsAppAccount[];
  webhookUrl: string;
}> {
  const headers = await authHeaders();
  const res = await fetch('/api/whatsapp/accounts', { headers });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load WhatsApp accounts');
  return {
    accounts: (data.accounts || []).map(mapAccount),
    webhookUrl: data.webhookUrl,
  };
}

export async function connectWhatsAppAccount(input: {
  clientId: string;
  phoneNumberId: string;
  accessToken: string;
  wabaId?: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
}): Promise<{ account: WhatsAppAccount; webhookUrl: string }> {
  const headers = await authHeaders();
  const res = await fetch('/api/whatsapp/accounts', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to connect WhatsApp');
  return { account: mapAccount(data.account), webhookUrl: data.webhookUrl };
}

export async function sendWhatsAppReply(conversationId: string, text: string) {
  const headers = await authHeaders();
  const res = await fetch('/api/whatsapp/send', {
    method: 'POST',
    headers,
    body: JSON.stringify({ conversationId, text }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to send message');
  return data;
}

export async function patchConversation(
  conversationId: string,
  patch: Partial<{
    lead_status: LeadStage;
    assigned_to: string | null;
    notes: string;
    priority: string;
    status: string;
    unread_count: number;
    campaign_id: string | null;
  }>
) {
  const headers = await authHeaders();
  const res = await fetch(`/api/whatsapp/conversations/${conversationId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update conversation');
  return mapConversation(data.conversation);
}

export async function suggestWhatsAppReply(input: {
  customerMessage: string;
  history?: string;
  clientName?: string;
}): Promise<string> {
  const headers = await authHeaders();
  const res = await fetch('/api/whatsapp/ai/suggest-reply', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to suggest reply');
  return data.suggestion as string;
}

export function subscribeToClientConversations(
  clientId: string,
  onUpdate: (conversations: CrmConversation[]) => void
): () => void {
  let channel: RealtimeChannel | null = null;

  const load = async () => {
    const { data, error } = await supabase
      .from('conversations')
      .select('*, contacts:contact_id(*)')
      .eq('client_id', clientId)
      .eq('channel', 'whatsapp')
      .order('last_message_at', { ascending: false, nullsFirst: false });
    if (error) {
      console.warn('conversations load error:', error.message);
      onUpdate([]);
      return;
    }
    onUpdate(((data as any[]) || []).map(mapConversation));
  };

  void load();

  channel = supabase
    .channel(`wa-conversations-${clientId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'conversations', filter: `client_id=eq.${clientId}` },
      () => void load()
    )
    .subscribe();

  return () => {
    if (channel) void supabase.removeChannel(channel);
  };
}

export function subscribeToConversationMessages(
  conversationId: string,
  onUpdate: (messages: CrmMessage[]) => void
): () => void {
  let channel: RealtimeChannel | null = null;

  const load = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: true });
    if (error) {
      console.warn('messages load error:', error.message);
      onUpdate([]);
      return;
    }
    onUpdate(((data as any[]) || []).map(mapMessage));
  };

  void load();

  channel = supabase
    .channel(`wa-messages-${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      () => void load()
    )
    .subscribe();

  return () => {
    if (channel) void supabase.removeChannel(channel);
  };
}

export const LEAD_STAGES: { id: LeadStage; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'quote', label: 'Quote / Proposal' },
  { id: 'negotiation', label: 'Negotiation' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
];
