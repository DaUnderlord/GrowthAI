import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  ImagePlus,
  Plus,
  RefreshCw,
  Send,
  Share2,
  Sparkles,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react';
import {
  CalendarAuditReport,
  CalendarCraftRole,
  CalendarShare,
  ClientProfile,
  ContentCalendarItem,
  UserProfile,
} from '../types';
import { EMPTY_AUDIT_REPORT } from '../data/mockCalendar';
import {
  calendarBriefUrl,
  createOrUpdateCalendarShare,
  deleteCalendarItem,
  listCalendarShares,
  revokeCalendarShare,
  saveCalendarItem,
  saveCalendarItems,
  subscribeToCalendarItems,
} from '../lib/supabase';
import { callGrowthAi, withBrandContext } from '../lib/aiApi';
import { LiveAccountNote } from './LiveAccountNote';
import { parseCalendarAuditMarkdown } from '../lib/clientInsights';
import { DataLoader } from './DataLoader';
import { useWorkspaceLocale } from '../lib/WorkspaceLocale';
import { dayNameForDate, scheduledAtIso, todayInZone } from '../../shared/calendarPublish';
import {
  fetchCalendarReadiness,
  flushDuePosts,
  publishCalendarItemNow,
  uploadCalendarMedia,
  type CalendarReadiness,
} from '../lib/calendarPublishApi';
import { navigateView } from '../lib/liveApi';

const CRAFT_OPTIONS: Array<{ id: CalendarCraftRole; label: string }> = [
  { id: 'designer', label: 'Graphic designer' },
  { id: 'video_editor', label: 'Video editor' },
  { id: 'social_marketer', label: 'Social marketer' },
  { id: 'copywriter', label: 'Copywriter' },
  { id: 'strategist', label: 'Strategist' },
  { id: 'collaborator', label: 'Collaborator' },
];

interface ContentCalendarViewProps {
  client: ClientProfile;
  users: UserProfile[];
  currentUser: UserProfile;
}

export const ContentCalendarView: React.FC<ContentCalendarViewProps> = ({
  client,
  users,
  currentUser,
}) => {
  const [calendarItems, setCalendarItems] = useState<ContentCalendarItem[]>([]);
  const [auditReport, setAuditReport] = useState<CalendarAuditReport>(EMPTY_AUDIT_REPORT);
  const [loading, setLoading] = useState(false);
  const [rawUploadText, setRawUploadText] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddPostModal, setShowAddPostModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [aiReportMarkdown, setAiReportMarkdown] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [appliedCorrections, setAppliedCorrections] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'local' | 'live'>('local');
  const [itemsReady, setItemsReady] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [activeShare, setActiveShare] = useState<CalendarShare | null>(null);
  const [shareMembers, setShareMembers] = useState<
    Record<string, { selected: boolean; craftRole: CalendarCraftRole }>
  >({});
  const [shareLabel, setShareLabel] = useState('Content calendar brief');
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const { timeZone } = useWorkspaceLocale();
  const [readiness, setReadiness] = useState<{ instagram: CalendarReadiness; facebook: CalendarReadiness } | null>(
    null
  );
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [newCaption, setNewCaption] = useState('');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaType, setNewMediaType] = useState<'image' | 'video' | ''>('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [savingAssetId, setSavingAssetId] = useState<string | null>(null);

  const handleDeletePost = async (id: string) => {
    setCalendarItems((prev) => prev.filter((item) => item.id !== id));
    setDeletingPostId(null);
    try {
      await deleteCalendarItem(id);
      setSyncStatus('live');
    } catch (err) {
      console.error(err);
    }
  };

  // Add post state
  const [newTopic, setNewTopic] = useState('');
  const [newHook, setNewHook] = useState('');
  const [newPlatform, setNewPlatform] = useState<any>('instagram');
  const [newType, setNewType] = useState<any>('Carousel');
  const [newDate, setNewDate] = useState(() => todayInZone());
  const [newTime, setNewTime] = useState('19:30');
  const [newCta, setNewCta] = useState('Comment "GLOW" for free guide');

  useEffect(() => {
    setItemsReady(false);
    const unsubscribe = subscribeToCalendarItems(client.id, (items) => {
      setCalendarItems(items);
      setItemsReady(true);
      setSyncStatus('live');
    });

    return () => unsubscribe();
  }, [client.id]);

  useEffect(() => {
    let cancelled = false;
    void fetchCalendarReadiness(client.id)
      .then((data) => {
        if (!cancelled) setReadiness(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client.id]);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      void flushDuePosts(client.id)
        .then((result) => {
          if (cancelled || !result.published.length) return;
          setPublishMessage(
            `Published ${result.published.length} due post${result.published.length === 1 ? '' : 's'} to Meta.`
          );
        })
        .catch(() => undefined);
    };
    run();
    const timer = window.setInterval(run, 45000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [client.id]);

  useEffect(() => {
    const defaults: Record<string, { selected: boolean; craftRole: CalendarCraftRole }> = {};
    users.forEach((u) => {
      const craft: CalendarCraftRole =
        u.role === 'creative'
          ? 'designer'
          : u.department?.toLowerCase().includes('video')
            ? 'video_editor'
            : u.department?.toLowerCase().includes('social')
              ? 'social_marketer'
              : 'collaborator';
      defaults[u.id] = { selected: false, craftRole: craft };
    });
    setShareMembers(defaults);
    setActiveShare(null);
    setShareMessage(null);

    void listCalendarShares(client.id)
      .then((shares) => {
        const latest = shares[0] || null;
        setActiveShare(latest);
        if (latest) {
          setShareLabel(latest.label);
          setShareMembers((prev) => {
            const next = { ...prev };
            latest.members.forEach((m) => {
              if (m.userId && next[m.userId]) {
                next[m.userId] = {
                  selected: true,
                  craftRole: (m.craftRole as CalendarCraftRole) || next[m.userId].craftRole,
                };
              }
            });
            return next;
          });
        }
      })
      .catch(() => undefined);
  }, [client.id, users]);

  const handleAnalyzeCalendar = async () => {
    setLoading(true);
    setAiError(null);
    try {
      const result = await callGrowthAi<{ auditReport: string }>('/api/growth/analyze-calendar', withBrandContext(client, {
        calendarData: calendarItems.map((item) => ({
          date: item.date,
          time: item.time,
          platform: item.platform,
          contentType: item.contentType,
          topic: item.topic,
          hookText: item.hookText,
          status: item.status,
          aiScore: item.aiScore,
        })),
        campaignGoal: client.primaryGoal,
        clientName: client.name,
      }));
      if (!result.ok) {
        setAiError(result.error);
      } else if (result.data.auditReport) {
        setAiReportMarkdown(result.data.auditReport);
        const parsed = parseCalendarAuditMarkdown(result.data.auditReport);
        setAuditReport((prev) => ({
          ...prev,
          overallScore: parsed.overallScore,
          strengths: parsed.strengths.length ? parsed.strengths : prev.strengths,
          gapsAndWeaknesses: parsed.gapsAndWeaknesses.length
            ? parsed.gapsAndWeaknesses
            : prev.gapsAndWeaknesses,
          suggestedCorrectionsCount: parsed.suggestedCorrectionsCount,
          campaignAlignmentScore: parsed.overallScore,
        }));
      }
    } catch (err: any) {
      setAiError(err?.message || 'Calendar audit failed');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyAiCorrections = async () => {
    const nextItems = calendarItems.map((item) => {
      if (item.status === 'needs_correction' || item.aiScore < 70) {
        const time = item.aiSuggestedTime || '19:30';
        return {
          ...item,
          hookText: item.aiSuggestedHook || item.hookText,
          time,
          status: 'scheduled' as const,
          aiScore: 90,
          aiFeedback: 'Corrected by GrowthOS AI: Optimized hook & peak evening posting window.',
          scheduledAt: scheduledAtIso(item.date, time, timeZone) || item.scheduledAt,
        };
      }
      return item;
    });

    setCalendarItems(nextItems);
    setAuditReport((prev) => ({
      ...prev,
      overallScore: 92,
      suggestedCorrectionsCount: 0,
      gapsAndWeaknesses: ['All identified hook & timing weaknesses have been resolved.'],
    }));
    setAppliedCorrections(true);

    try {
      await saveCalendarItems(nextItems);
      setSyncStatus('live');
    } catch (err) {
      console.error(err);
    }
  };

  const shareableUrl = activeShare ? calendarBriefUrl(activeShare.token) : '';

  const handleCopyShareLink = () => {
    if (!shareableUrl) return;
    navigator.clipboard.writeText(shareableUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSaveShare = async () => {
    setShareBusy(true);
    setShareMessage(null);
    try {
      const members = users
        .filter((u) => shareMembers[u.id]?.selected)
        .map((u) => ({
          userId: u.id,
          email: u.email,
          name: u.name,
          craftRole: shareMembers[u.id]?.craftRole || 'collaborator',
        }));

      const share = await createOrUpdateCalendarShare({
        clientId: client.id,
        orgId: currentUser.orgId,
        createdBy: currentUser.id,
        label: shareLabel.trim() || `${client.name} content calendar`,
        accessMode: 'read_only',
        members,
        existingShareId: activeShare?.id,
      });
      setActiveShare(share);
      setShareMessage(
        members.length
          ? `Brief ready. Shared with ${members.length} teammate${members.length === 1 ? '' : 's'}.`
          : 'Read-only brief link ready. Add teammates anytime.'
      );
    } catch (err: any) {
      setShareMessage(err.message || 'Could not create share link.');
    } finally {
      setShareBusy(false);
    }
  };

  const handleRevokeShare = async () => {
    if (!activeShare) return;
    setShareBusy(true);
    try {
      await revokeCalendarShare(activeShare.id);
      setActiveShare(null);
      setShareMessage('Brief link revoked.');
    } catch (err: any) {
      setShareMessage(err.message || 'Could not revoke share.');
    } finally {
      setShareBusy(false);
    }
  };

  const handleAssignPost = async (
    item: ContentCalendarItem,
    assigneeId: string,
    craft: CalendarCraftRole
  ) => {
    const user = users.find((u) => u.id === assigneeId);
    const updated: ContentCalendarItem = {
      ...item,
      assigneeId: assigneeId || undefined,
      assigneeName: user?.name || undefined,
      assigneeCraft: assigneeId ? craft : undefined,
      designerStatus: assigneeId ? item.designerStatus || 'in_brief' : item.designerStatus,
    };
    setCalendarItems((prev) => prev.map((p) => (p.id === item.id ? updated : p)));
    try {
      await saveCalendarItem(updated);
      setSyncStatus('live');
    } catch (err) {
      console.error(err);
    }
  };

  const handleImportCalendar = async () => {
    if (!rawUploadText.trim()) return;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const lines = rawUploadText.split('\n').filter((l) => l.trim().length > 0);
    const newItems: ContentCalendarItem[] = lines.slice(0, 20).map((line, idx) => {
      // Supports: YYYY-MM-DD | topic | hook   OR free-text lines
      const parts = line.split('|').map((p) => p.trim()).filter(Boolean);
      const hasDate = parts[0] && /^\d{4}-\d{2}-\d{2}$/.test(parts[0]);
      const base = new Date();
      base.setDate(base.getDate() + idx);
      const date = hasDate
        ? parts[0]
        : `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
      const topic = hasDate ? (parts[1] || `Imported post ${idx + 1}`) : parts[0].slice(0, 60);
      const hook = hasDate
        ? (parts[2] || parts[1] || topic)
        : (parts[0].length > 30 ? parts[0] : `${parts[0]} — here's why it matters`);
      const d = new Date(`${date}T12:00:00`);
      return {
        id: `imported-${Date.now()}-${idx}`,
        clientId: client.id,
        date,
        dayOfWeek: dayNames[d.getDay()] || 'Monday',
        time: '19:30',
        platform: (idx % 2 === 0 ? 'instagram' : 'tiktok') as ContentCalendarItem['platform'],
        contentType: (idx % 2 === 0 ? 'Reel' : 'Carousel') as ContentCalendarItem['contentType'],
        topic: topic.slice(0, 80),
        hookText: hook.slice(0, 180),
        captionText: `Full breakdown of ${topic}.`,
        cta: 'Comment for the guide',
        status: 'scheduled' as const,
        aiScore: 85,
        aiFeedback: 'Imported calendar entry.',
        scheduledAt: scheduledAtIso(date, '19:30', timeZone) || undefined,
      };
    });

    setCalendarItems((prev) => [...newItems, ...prev]);
    setShowUploadModal(false);
    setRawUploadText('');

    try {
      await saveCalendarItems(newItems);
      setSyncStatus('live');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveNewPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic || !newHook) return;

    const newItem: ContentCalendarItem = {
      id: `post-${Date.now()}`,
      clientId: client.id,
      date: newDate,
      dayOfWeek: dayNameForDate(newDate, timeZone),
      time: newTime,
      platform: newPlatform,
      contentType: newType,
      topic: newTopic,
      hookText: newHook,
      captionText: newCaption.trim() || `${newTopic}. ${newHook}`.trim(),
      cta: newCta,
      status: 'scheduled',
      aiScore: 88,
      aiFeedback: 'Custom user-created post entry.',
      visualAssetUrl: newMediaUrl || undefined,
      visualAssetType: newMediaType || undefined,
      scheduledAt: scheduledAtIso(newDate, newTime, timeZone) || undefined,
    };

    setCalendarItems([newItem, ...calendarItems]);
    setShowAddPostModal(false);
    setNewTopic('');
    setNewHook('');
    setNewCaption('');
    setNewMediaUrl('');
    setNewMediaType('');

    try {
      await saveCalendarItem(newItem);
      setSyncStatus('live');
    } catch (err) {
      console.error(err);
    }
  };

  const handleUploadForItem = async (item: ContentCalendarItem, file: File) => {
    if (!currentUser.orgId) {
      setPublishMessage('Finish workspace onboarding before uploading media.');
      return;
    }
    setSavingAssetId(item.id);
    try {
      const uploaded = await uploadCalendarMedia(currentUser.orgId, client.id, file);
      const updated = {
        ...item,
        visualAssetUrl: uploaded.url,
        visualAssetType: uploaded.type,
        publishError: undefined,
        publishBlocked: false,
      };
      setCalendarItems((prev) => prev.map((row) => (row.id === item.id ? updated : row)));
      await saveCalendarItem(updated);
      setSyncStatus('live');
    } catch (err: any) {
      setPublishMessage(err.message || 'Could not upload media.');
    } finally {
      setSavingAssetId(null);
    }
  };

  const handleNewMediaFile = async (file?: File | null) => {
    if (!file) return;
    if (!currentUser.orgId) {
      setPublishMessage('Finish workspace onboarding before uploading media.');
      return;
    }
    setUploadingMedia(true);
    try {
      const uploaded = await uploadCalendarMedia(currentUser.orgId, client.id, file);
      setNewMediaUrl(uploaded.url);
      setNewMediaType(uploaded.type);
    } catch (err: any) {
      setPublishMessage(err.message || 'Could not upload media.');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleSaveCaption = async (item: ContentCalendarItem, captionText: string) => {
    const updated = { ...item, captionText };
    setCalendarItems((prev) => prev.map((row) => (row.id === item.id ? updated : row)));
    try {
      await saveCalendarItem(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePublishNow = async (item: ContentCalendarItem) => {
    setPublishingId(item.id);
    setPublishMessage(null);
    try {
      const result = await publishCalendarItemNow(item.id);
      setPublishMessage(
        result.alreadyPublished
          ? 'Already live on Meta.'
          : `Published to ${result.accountLabel || item.platform}${result.note ? ` · ${result.note}` : ''}`
      );
    } catch (err: any) {
      setPublishMessage(err.message || 'Publish failed.');
    } finally {
      setPublishingId(null);
    }
  };

  const statusLabel = (item: ContentCalendarItem) => {
    if (item.status === 'published' || item.providerPostId) return { text: 'Published', className: 'text-emerald-300' };
    if (item.publishBlocked || item.publishError) return { text: 'Failed', className: 'text-rose-300' };
    if (item.status === 'needs_correction') return { text: 'Review', className: 'text-amber-300' };
    if (item.status === 'draft') return { text: 'Draft', className: 'text-slate-500' };
    const due = item.scheduledAt && new Date(item.scheduledAt).getTime() <= Date.now();
    return due
      ? { text: 'Due', className: 'text-cyan-300' }
      : { text: 'Scheduled', className: 'text-slate-500' };
  };

  const canPublishPlatform = (platform: string) => {
    if (platform === 'instagram') return Boolean(readiness?.instagram.canPublish);
    if (platform === 'facebook') return Boolean(readiness?.facebook.canPublish);
    return false;
  };

  const stats = useMemo(() => {
    const scheduled = calendarItems.filter((item) => item.status === 'scheduled').length;
    const needsAttention = calendarItems.filter((item) => item.status === 'needs_correction').length;
    const averageScore = Math.round(
      calendarItems.reduce((sum, item) => sum + item.aiScore, 0) / Math.max(calendarItems.length, 1)
    );

    return { scheduled, needsAttention, averageScore };
  }, [calendarItems]);

  return (
    <div className="fade-rise relative space-y-5 sm:space-y-6">
      {!itemsReady && <DataLoader variant="overlay" label="Loading calendar…" />}
      {loading && <DataLoader variant="overlay" label="Auditing calendar…" />}
      <div className="surface-panel p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow-label">Content calendar</p>
            <h2 className="font-display mt-1 text-3xl font-medium text-white">Schedule</h2>
            <p className="mt-2 text-sm text-slate-400">
              {stats.scheduled} scheduled · {stats.needsAttention} need review · avg score {stats.averageScore}.
              Instagram and Facebook Page posts go live at the scheduled time in {timeZone}.
            </p>
          </div>
          <div className="relative flex flex-wrap items-center gap-2">
            <button onClick={() => setShowAddPostModal(true)} className="primary-button">
              <Plus className="h-4 w-4" />
              <span>Add post</span>
            </button>
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className="secondary-button"
            >
              More
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#0d1520] py-1 shadow-xl">
                <button
                  onClick={() => {
                    setShowShareModal(true);
                    setMoreOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/[0.04]"
                >
                  <Share2 className="h-3.5 w-3.5" /> Share plan
                </button>
                <button
                  onClick={() => {
                    setShowUploadModal(true);
                    setMoreOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/[0.04]"
                >
                  <Upload className="h-3.5 w-3.5" /> Import schedule
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="reveal-panel">
        <button
          type="button"
          onClick={() => setAuditOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-4 p-5 text-left hover:bg-white/[0.02]"
        >
          <div>
            <p className="eyebrow-label">Calendar health</p>
            <p className="mt-2 text-base font-medium text-white">
              {auditReport.overallScore > 0
                ? `Score ${auditReport.overallScore} · ${client.primaryGoal}`
                : `No AI audit yet · ${client.primaryGoal}`}
            </p>
          </div>
          <span className="text-link text-xs">{auditOpen ? 'Hide audit' : 'View audit'}</span>
        </button>
        {auditOpen && (
          <div className="space-y-4 border-t border-white/[0.06] p-5">
            <div className="flex flex-wrap gap-2">
              {auditReport.suggestedCorrectionsCount > 0 && !appliedCorrections && (
                <button onClick={handleApplyAiCorrections} className="primary-button">
                  <Zap className="h-4 w-4" />
                  <span>Apply {auditReport.suggestedCorrectionsCount} fixes</span>
                </button>
              )}
              <button onClick={handleAnalyzeCalendar} disabled={loading} className="secondary-button">
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span>{loading ? 'Auditing…' : 'Run AI audit'}</span>
              </button>
            </div>
            <LiveAccountNote client={client} />
            <div className="grid gap-3 text-xs md:grid-cols-2">
              <div className="surface-subtle p-4">
                <p className="mb-2 text-sm text-white">Strengths</p>
                <ul className="space-y-2 text-slate-400">
                  {auditReport.strengths.map((item, i) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div className="surface-subtle p-4">
                <p className="mb-2 text-sm text-white">Gaps</p>
                <ul className="space-y-2 text-slate-400">
                  {auditReport.gapsAndWeaknesses.map((item, i) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>
              </div>
            </div>
            {aiError && (
              <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                {aiError}
              </div>
            )}
            {aiReportMarkdown && (
              <div className="surface-subtle whitespace-pre-line p-4 text-sm text-slate-300">{aiReportMarkdown}</div>
            )}
          </div>
        )}
      </div>

      <div className="surface-panel overflow-hidden">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <p className="eyebrow-label">Posts</p>
          <h3 className="font-display mt-1 text-xl font-medium text-white">Live schedule</h3>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Instagram and Facebook publish for real when the time hits. TikTok and LinkedIn stay on this calendar only.
          </p>
          {readiness && (
            <div className="mt-3 space-y-1 text-xs text-slate-400">
              <p>
                Instagram:{' '}
                {readiness.instagram.canPublish
                  ? `Publishing enabled${readiness.instagram.accountName ? ` · ${readiness.instagram.accountName}` : ''}`
                  : readiness.instagram.note || 'Connect the professional account to publish.'}
              </p>
              <p>
                Facebook:{' '}
                {readiness.facebook.canPublish
                  ? `Publishing enabled${readiness.facebook.accountName ? ` · ${readiness.facebook.accountName}` : ''}`
                  : readiness.facebook.note || 'Connect the Page to publish.'}
              </p>
              {(!readiness.instagram.canPublish || !readiness.facebook.canPublish) && (
                <button type="button" className="text-link" onClick={() => navigateView('agency')}>
                  Open Social accounts to reconnect Meta
                </button>
              )}
            </div>
          )}
          {publishMessage && <p className="mt-3 text-xs text-cyan-200">{publishMessage}</p>}
        </div>
        <div className="divide-y divide-white/[0.05]">
          {calendarItems.length === 0 && (
            <div className="px-5 py-8 text-sm text-slate-400">
              No scheduled posts yet. Add a post with a public image or video for Instagram, or a caption for Facebook.
            </div>
          )}
          {calendarItems.map((item) => {
            const expanded = expandedPostId === item.id;
            const badge = statusLabel(item);
            const livePlatform = item.platform === 'instagram' || item.platform === 'facebook';
            return (
              <div key={item.id} className={item.status === 'needs_correction' ? 'bg-amber-500/[0.03]' : ''}>
                <button
                  type="button"
                  onClick={() => setExpandedPostId(expanded ? null : item.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.02] sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{item.topic}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {item.date} {item.time} · {item.platform} · {item.contentType}
                      {item.assigneeName ? ` · ${item.assigneeName}` : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[11px] ${badge.className}`}>{badge.text}</span>
                </button>
                {expanded && (
                  <div className="space-y-3 border-t border-white/[0.04] px-4 py-4 sm:px-5">
                    <p className="text-sm text-slate-400">&ldquo;{item.hookText}&rdquo;</p>
                    <label className="block text-[11px] text-slate-500">
                      Caption that goes live
                      <textarea
                        defaultValue={item.captionText}
                        key={`${item.id}-${item.captionText}`}
                        onBlur={(e) => {
                          if (e.target.value !== item.captionText) void handleSaveCaption(item, e.target.value);
                        }}
                        rows={3}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white"
                      />
                    </label>
                    <p className="text-xs text-slate-500">CTA: {item.cta}</p>
                    {item.visualAssetUrl ? (
                      <p className="truncate text-[11px] text-slate-400">Media: {item.visualAssetUrl}</p>
                    ) : (
                      <p className="text-[11px] text-amber-200">
                        {item.platform === 'facebook'
                          ? 'No media yet. Facebook can still publish a text post.'
                          : 'No public media yet. Instagram needs an uploaded image or video.'}
                      </p>
                    )}
                    {item.publishError && <p className="text-xs text-rose-200">{item.publishError}</p>}
                    {item.providerPermalink && (
                      <a
                        href={item.providerPermalink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-cyan-300"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> View live post
                      </a>
                    )}
                    {item.status === 'needs_correction' && item.aiSuggestedHook && (
                      <p className="text-xs text-amber-200">
                        Try: &ldquo;{item.aiSuggestedHook}&rdquo; at {item.aiSuggestedTime || '19:30'}
                      </p>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11px] text-slate-500">Assign to</label>
                        <select
                          value={item.assigneeId || ''}
                          onChange={(e) =>
                            handleAssignPost(
                              item,
                              e.target.value,
                              (item.assigneeCraft as CalendarCraftRole) || 'collaborator'
                            )
                          }
                          className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white"
                        >
                          <option value="">Unassigned</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.role})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-slate-500">Craft role</label>
                        <select
                          value={(item.assigneeCraft as CalendarCraftRole) || 'collaborator'}
                          disabled={!item.assigneeId}
                          onChange={(e) =>
                            handleAssignPost(item, item.assigneeId || '', e.target.value as CalendarCraftRole)
                          }
                          className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-40"
                        >
                          {CRAFT_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <label className="secondary-button !py-1.5 text-xs">
                        <ImagePlus className="h-3.5 w-3.5" />
                        {savingAssetId === item.id ? 'Uploading…' : 'Upload media'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (file) void handleUploadForItem(item, file);
                          }}
                        />
                      </label>
                      {livePlatform && (
                        <button
                          type="button"
                          disabled={publishingId === item.id}
                          onClick={() => void handlePublishNow(item)}
                          className="primary-button !py-1.5 text-xs"
                        >
                          {publishingId === item.id ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          {item.providerPostId
                            ? 'Already published'
                            : publishingId === item.id
                              ? 'Publishing…'
                              : canPublishPlatform(item.platform)
                                ? 'Publish now'
                                : 'Try publish'}
                        </button>
                      )}
                      {deletingPostId === item.id ? (
                        <button onClick={() => handleDeletePost(item.id)} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs text-white">
                          Confirm delete
                        </button>
                      ) : (
                        <button
                          onClick={() => setDeletingPostId(item.id)}
                          className="secondary-button !py-1.5 text-xs"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      )}
                    </div>
                    {!livePlatform && (
                      <p className="text-[11px] text-slate-500">
                        Saved on the calendar only. GrowthOS does not upload to {item.platform} yet.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-semibold text-white">Share calendar with team</h3>
              <button onClick={() => setShowShareModal(false)} className="text-slate-400 hover:text-white">
                x
              </button>
            </div>

            <p className="text-sm leading-6 text-slate-400">
              Invite designers, editors, and marketers onto a read-only brief for{' '}
              <span className="font-medium text-white">{client.name}</span>. No login required to view the link.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-slate-300">Brief title</label>
                <input
                  type="text"
                  value={shareLabel}
                  onChange={(e) => setShareLabel(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="mb-2 block font-semibold text-slate-300">Team members</label>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/50 p-2">
                  {users.length === 0 && (
                    <p className="px-2 py-3 text-slate-500">Invite teammates under Team first.</p>
                  )}
                  {users.map((u) => {
                    const state = shareMembers[u.id] || {
                      selected: false,
                      craftRole: 'collaborator' as CalendarCraftRole,
                    };
                    return (
                      <div
                        key={u.id}
                        className="flex flex-col gap-2 rounded-xl border border-white/5 px-2 py-2 sm:flex-row sm:items-center"
                      >
                        <label className="flex min-w-0 flex-1 items-center gap-2 text-slate-300">
                          <input
                            type="checkbox"
                            checked={state.selected}
                            onChange={(e) =>
                              setShareMembers((prev) => ({
                                ...prev,
                                [u.id]: { ...state, selected: e.target.checked },
                              }))
                            }
                          />
                          <span className="truncate">
                            {u.name}
                            <span className="text-slate-500"> · {u.email}</span>
                          </span>
                        </label>
                        <select
                          value={state.craftRole}
                          disabled={!state.selected}
                          onChange={(e) =>
                            setShareMembers((prev) => ({
                              ...prev,
                              [u.id]: {
                                ...state,
                                craftRole: e.target.value as CalendarCraftRole,
                              },
                            }))
                          }
                          className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-[11px] text-white disabled:opacity-40"
                        >
                          {CRAFT_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleSaveShare}
                  disabled={shareBusy}
                  className="primary-button"
                >
                  {shareBusy ? 'Saving…' : activeShare ? 'Update brief link' : 'Create brief link'}
                </button>
                {activeShare && (
                  <button
                    onClick={handleRevokeShare}
                    disabled={shareBusy}
                    className="secondary-button"
                  >
                    Revoke link
                  </button>
                )}
              </div>

              {shareMessage && <p className="text-[11px] text-cyan-200">{shareMessage}</p>}

              {activeShare && (
                <div>
                  <label className="mb-1 block font-semibold text-slate-300">Read-only brief URL</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareableUrl}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-[11px] text-slate-300"
                    />
                    <button onClick={handleCopyShareLink} className="primary-button whitespace-nowrap">
                      {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Anyone with this link can view posts, hooks, CTAs, and assignees. They cannot edit.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setShowShareModal(false)} className="secondary-button">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg space-y-4 rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Import a content plan</h3>
            <p className="text-sm leading-6 text-slate-400">
              Paste a rough schedule and GrowthOS will turn it into structured post entries.
            </p>

            <textarea
              rows={6}
              value={rawUploadText}
              onChange={(e) => setRawUploadText(e.target.value)}
              placeholder="e.g.
Topic 1: 5 Skincare Myths destroying barrier
Topic 2: Behind the scenes clinic walkthrough
Topic 3: Doctor Q&A on acne treatments..."
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setShowUploadModal(false)} className="secondary-button">
                Cancel
              </button>
              <button onClick={handleImportCalendar} className="primary-button">Import schedule</button>
            </div>
          </div>
        </div>
      )}

      {showAddPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Add a scheduled post</h3>
            <p className="text-xs leading-5 text-slate-400">
              Times use {timeZone}. Instagram needs a public image or video. Facebook can publish a caption alone.
            </p>
            <form onSubmit={handleSaveNewPost} className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-slate-300">Post topic</label>
                <input
                  type="text"
                  required
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  placeholder="e.g. Morning Skin Barrier Hydration Guide"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-300">Opening hook</label>
                <input
                  type="text"
                  required
                  value={newHook}
                  onChange={(e) => setNewHook(e.target.value)}
                  placeholder="e.g. Stop wasting money on serum until you try this..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-slate-300">Platform</label>
                  <select
                    value={newPlatform}
                    onChange={(e) => setNewPlatform(e.target.value as any)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
                  >
                    <option value="instagram">Instagram (publishes live)</option>
                    <option value="facebook">Facebook Page (publishes live)</option>
                    <option value="tiktok">TikTok (calendar only)</option>
                    <option value="linkedin">LinkedIn (calendar only)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-300">Format</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
                  >
                    <option value="Carousel">Photo / carousel</option>
                    <option value="Reel">Reel / Video</option>
                    <option value="Story">Story</option>
                    <option value="Article">Article</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-slate-300">Scheduled date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-300">Posting time</label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-300">Caption that goes live</label>
                <textarea
                  rows={3}
                  value={newCaption}
                  onChange={(e) => setNewCaption(e.target.value)}
                  placeholder="This is the text Meta will post."
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-300">Call to action</label>
                <input
                  type="text"
                  value={newCta}
                  onChange={(e) => setNewCta(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-300">Media</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void handleNewMediaFile(file);
                  }}
                  className="w-full text-slate-300"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  {uploadingMedia
                    ? 'Uploading to public storage…'
                    : newMediaUrl
                      ? `Ready: ${newMediaUrl}`
                      : 'JPEG, PNG, WebP, MP4, or MOV. Meta fetches this URL.'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowAddPostModal(false)} className="secondary-button">
                  Cancel
                </button>
                <button type="submit" className="primary-button">Save post</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
