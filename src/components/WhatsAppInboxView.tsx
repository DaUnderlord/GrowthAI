import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { ClientProfile, CrmConversation, CrmMessage, LeadStage, UserProfile } from '../types';
import {
  LEAD_STAGES,
  connectWhatsAppAccount,
  fetchWhatsAppAccounts,
  patchConversation,
  sendWhatsAppReply,
  subscribeToClientConversations,
  subscribeToConversationMessages,
  suggestWhatsAppReply,
} from '../lib/whatsapp';
import { MetaOnboarding } from './MetaOnboarding';
import { ConnectAccountsPrompt } from './ConnectAccountsPrompt';
import { DataLoader } from './DataLoader';
import { authFetch } from '../lib/authFetch';
import { useWorkspaceLocale } from '../lib/WorkspaceLocale';

interface WhatsAppInboxViewProps {
  client: ClientProfile;
  users: UserProfile[];
  currentUser: UserProfile;
}

function formatTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const WhatsAppInboxView: React.FC<WhatsAppInboxViewProps> = ({
  client,
  users,
  currentUser,
}) => {
  const [conversations, setConversations] = useState<CrmConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CrmMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stageBusy, setStageBusy] = useState(false);

  const { t } = useWorkspaceLocale();
  const [showConnect, setShowConnect] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [hasAccount, setHasAccount] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [displayPhone, setDisplayPhone] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [connectBusy, setConnectBusy] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [inboxReady, setInboxReady] = useState(false);
  const [verifyToken, setVerifyToken] = useState('');
  const [filterStage, setFilterStage] = useState<'all' | LeadStage>('all');

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId]
  );

  useEffect(() => {
    let cancelled = false;
    void fetchWhatsAppAccounts()
      .then(({ accounts, webhookUrl: url }) => {
        if (cancelled) return;
        setWebhookUrl(url);
        const forClient = accounts.filter((a) => a.clientId === client.id);
        const connected = forClient.some((a) => a.status === 'connected') || accounts.length > 0;
        setHasAccount(connected);
        if (connected) setShowConnect(false);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    void authFetch('/api/org/meta')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data.success) return;
        if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
        if (data.verifyToken) setVerifyToken(data.verifyToken);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client.id]);

  useEffect(() => {
    setInboxReady(false);
    return subscribeToClientConversations(client.id, (rows) => {
      setConversations(rows);
      setInboxReady(true);
      setSelectedId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev;
        return rows[0]?.id || null;
      });
    });
  }, [client.id]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    return subscribeToConversationMessages(selectedId, setMessages);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const conv = conversations.find((c) => c.id === selectedId);
    if (conv && conv.unreadCount > 0) {
      void patchConversation(selectedId, { unread_count: 0 }).catch(() => undefined);
    }
  }, [selectedId, conversations]);

  const filtered = useMemo(() => {
    if (filterStage === 'all') return conversations;
    return conversations.filter((c) => c.leadStatus === filterStage);
  }, [conversations, filterStage]);

  const handleSend = async () => {
    if (!selectedId || !draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      await sendWhatsAppReply(selectedId, draft.trim());
      setDraft('');
    } catch (err: any) {
      setError(err.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const handleSuggest = async () => {
    if (!selected) return;
    const lastIncoming = [...messages].reverse().find((m) => m.direction === 'incoming');
    if (!lastIncoming?.text) {
      setError('No customer message to reply to yet.');
      return;
    }
    setSuggesting(true);
    setError(null);
    try {
      const suggestion = await suggestWhatsAppReply({
        customerMessage: lastIncoming.text,
        history: messages
          .slice(-8)
          .map((m) => `${m.direction}: ${m.text || ''}`)
          .join('\n'),
        clientName: client.name,
      });
      setDraft(suggestion);
    } catch (err: any) {
      setError(err.message || 'Suggestion failed');
    } finally {
      setSuggesting(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnectBusy(true);
    setError(null);
    try {
      const result = await connectWhatsAppAccount({
        clientId: client.id,
        phoneNumberId: phoneNumberId.trim(),
        accessToken: accessToken.trim(),
        wabaId: wabaId.trim() || undefined,
        displayPhoneNumber: displayPhone.trim() || undefined,
      });
      setWebhookUrl(result.webhookUrl);
      setHasAccount(true);
      setShowConnect(false);
      setAccessToken('');
    } catch (err: any) {
      setError(err.message || 'Connection failed');
    } finally {
      setConnectBusy(false);
    }
  };

  const updateLeadStage = async (stage: LeadStage) => {
    if (!selected) return;
    setStageBusy(true);
    try {
      const updated = await patchConversation(selected.id, { lead_status: stage });
      setConversations((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setStageBusy(false);
    }
  };

  const assignTo = async (userId: string) => {
    if (!selected) return;
    try {
      const updated = await patchConversation(selected.id, {
        assigned_to: userId || null,
      });
      setConversations((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="fade-rise relative space-y-4">
      {!inboxReady && <DataLoader variant="overlay" label="Loading WhatsApp inbox…" />}
      {(connectBusy || suggesting) && (
        <DataLoader
          variant="overlay"
          label={connectBusy ? 'Connecting WhatsApp…' : 'Drafting reply…'}
        />
      )}
      <div className="surface-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div>
          <p className="eyebrow-label">{t('whatsapp')}</p>
          <h2 className="font-display mt-1 text-3xl font-medium text-white">{t('whatsappInbox')} · {client.name}</h2>
          <p className="mt-2 text-sm text-slate-400">{t('whatsappIntro')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="secondary-button" onClick={() => setShowConnect((v) => !v)}>
            <Wifi className="h-4 w-4" />
            <span>{hasAccount ? t('connect') : t('connectWhatsApp')}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      {!hasAccount && (
        <>
          <ConnectAccountsPrompt client={client} needed={['meta']} />
          <p className="text-sm text-slate-400">{t('noWhatsAppYet')}</p>
          <MetaOnboarding client={client} />
        </>
      )}

      {showConnect && (
        <div className="surface-panel space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Connect WhatsApp Business Cloud API</h3>
              <p className="mt-1 text-xs text-slate-400">
                Tokens stay on the server. Point Meta webhooks to the URL below (public HTTPS required).
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-slate-500">Webhook URL</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={webhookUrl || `${window.location.origin}/api/meta/webhook`}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-300"
              />
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl || `${window.location.origin}/api/meta/webhook`);
                  setCopiedWebhook(true);
                  setTimeout(() => setCopiedWebhook(false), 2000);
                }}
              >
                {copiedWebhook ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Use this verify token in the Meta webhook settings
              {verifyToken ? (
                <>
                  : <code className="text-cyan-200">{verifyToken}</code>
                </>
              ) : (
                '. Save your Meta app in Agency Hub → Connect apps so GrowthOS can show the verify token from your workspace.'
              )}
            </p>
          </div>

          <form onSubmit={handleConnect} className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">Phone Number ID</label>
              <input
                required
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">Display number</label>
              <input
                value={displayPhone}
                onChange={(e) => setDisplayPhone(e.target.value)}
                placeholder="+234..."
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">WABA ID (optional)</label>
              <input
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">Permanent access token</label>
              <input
                required
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2">
              <button type="button" className="secondary-button" onClick={() => setShowConnect(false)}>
                Cancel
              </button>
              <button type="submit" className="primary-button" disabled={connectBusy}>
                {connectBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                <span>Save connection</span>
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid min-h-[70vh] overflow-hidden rounded-3xl border border-white/10 bg-[#0a121a] lg:grid-cols-[280px_minmax(0,1fr)_300px]">
        {/* Left: conversations */}
        <div className="flex flex-col border-b border-white/10 lg:border-b-0 lg:border-r">
          <div className="border-b border-white/10 p-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <MessageCircle className="h-3.5 w-3.5" />
              <span>{filtered.length} conversations</span>
            </div>
            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value as any)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white"
            >
              <option value="all">All stages</option>
              {LEAD_STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="p-4 text-sm text-slate-500">
                No WhatsApp conversations yet. Connect a number and wait for inbound messages.
              </p>
            )}
            {filtered.map((conv) => {
              const active = conv.id === selectedId;
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => setSelectedId(conv.id)}
                  className={`flex w-full flex-col gap-1 border-b border-white/[0.04] px-3 py-3 text-left ${
                    active ? 'bg-[color:var(--accent-soft)]' : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-white">
                      {conv.contact?.name || conv.contact?.phone || 'Unknown'}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-slate-950">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-500">{conv.lastMessage || '—'}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span className="capitalize">{conv.leadStatus}</span>
                    <span>{formatTime(conv.lastMessageAt)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center: thread */}
        <div className="flex min-h-[420px] flex-col border-b border-white/10 lg:border-b-0 lg:border-r">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-500">
              Select a conversation
            </div>
          ) : (
            <>
              <div className="border-b border-white/10 px-4 py-3">
                <p className="text-sm font-semibold text-white">
                  {selected.contact?.name || selected.contact?.phone}
                </p>
                <p className="text-xs text-slate-500">+{selected.contact?.phone}</p>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto bg-[#071018] p-4">
                {messages.map((m) => {
                  const mine = m.direction === 'outgoing';
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                          mine
                            ? 'rounded-br-md bg-[#005c4b] text-white'
                            : 'rounded-bl-md bg-[#1f2c34] text-slate-100'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.text || `[${m.type}]`}</p>
                        <p className="mt-1 text-right text-[10px] text-white/50">
                          {formatTime(m.timestamp)}
                          {mine ? ` · ${m.status}` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2 border-t border-white/10 p-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSuggest}
                    disabled={suggesting}
                    className="secondary-button !py-1.5 text-xs"
                  >
                    {suggesting ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    <span>AI suggest</span>
                  </button>
                </div>
                <div className="flex gap-2">
                  <textarea
                    rows={2}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type a reply…"
                    className="w-full resize-none rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={sending || !draft.trim()}
                    className="primary-button self-end"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right: CRM */}
        <div className="overflow-y-auto p-4">
          {!selected ? (
            <p className="text-sm text-slate-500">CRM panel appears when a chat is selected.</p>
          ) : (
            <div className="space-y-4 text-sm">
              <div>
                <p className="eyebrow-label">Lead</p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {selected.contact?.name || 'Contact'}
                </p>
                <p className="text-xs text-slate-500">+{selected.contact?.phone}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="surface-subtle p-3">
                  <p className="text-[11px] text-slate-500">Lead score</p>
                  <p className="mt-1 text-xl font-semibold text-cyan-200">{selected.leadScore}</p>
                </div>
                <div className="surface-subtle p-3">
                  <p className="text-[11px] text-slate-500">Priority</p>
                  <p className="mt-1 text-sm font-semibold capitalize text-white">{selected.priority}</p>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Stage</label>
                <select
                  disabled={stageBusy}
                  value={selected.leadStatus}
                  onChange={(e) => void updateLeadStage(e.target.value as LeadStage)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  {LEAD_STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Assigned to</label>
                <select
                  value={selected.assignedTo || ''}
                  onChange={(e) => void assignTo(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.id === currentUser.id ? '(you)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selected.aiSummary && (
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-3">
                  <p className="text-[11px] font-semibold text-cyan-200">AI summary</p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">{selected.aiSummary}</p>
                  {selected.recommendedAction && (
                    <p className="mt-2 text-[11px] text-slate-400">
                      Next: {selected.recommendedAction.replace(/_/g, ' ')}
                    </p>
                  )}
                </div>
              )}

              {selected.metaAttribution && Object.keys(selected.metaAttribution).length > 0 && (
                <div className="surface-subtle p-3">
                  <p className="text-[11px] font-semibold text-slate-300">Attribution</p>
                  <pre className="mt-2 overflow-x-auto text-[10px] text-slate-500">
                    {JSON.stringify(selected.metaAttribution, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Notes</label>
                <textarea
                  rows={4}
                  defaultValue={selected.notes || ''}
                  key={selected.id + '-notes'}
                  onBlur={(e) => {
                    void patchConversation(selected.id, { notes: e.target.value }).catch((err) =>
                      setError(err.message)
                    );
                  }}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
