import { useEffect, useState } from 'react';
import { authFetch } from './authFetch';
import { AudiencePersona, ConnectedPlatform, ConversionPath, PostPerformance } from '../types';

export type LiveInsights = {
  source?: string;
  growth_score?: number;
  virality_score?: number;
  engagement_health?: number;
  conversion_score?: number;
  roi_multiplier?: number;
  trends?: Array<{ month: string; reach: number; engagement: number; leads: number; conversions: number; revenue: number }>;
  personas?: AudiencePersona[];
  attribution?: ConversionPath[];
  posts?: PostPerformance[];
  demographics?: { notes?: string[] };
  updated_at?: string;
};

export async function fetchLiveInsights(clientId: string): Promise<LiveInsights | null> {
  const res = await authFetch(`/api/insights/${clientId}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to load insights');
  return data.insights || null;
}

export function useLiveInsights(clientId?: string) {
  const [insights, setInsights] = useState<LiveInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    setLoading(true);
    fetchLiveInsights(clientId)
      .then((data) => {
        if (!cancelled) setInsights(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return { insights, loading, error, refresh: () => (clientId ? fetchLiveInsights(clientId).then(setInsights) : Promise.resolve()) };
}

export function oauthRedirectUri() {
  return `${window.location.origin}/auth/callback`;
}

export function connectionsToPlatforms(rows: any[]): ConnectedPlatform[] {
  return (rows || []).map((row) => ({
    id: row.platform,
    connectionId: row.id,
    name: row.platform,
    icon: 'Globe',
    connected: row.status === 'connected' || row.status === 'error' || row.status === 'needs_selection',
    accountName: row.account_name,
    followers: Number(row.followers || 0),
    growthRate: Number(row.growth_rate || 0),
    lastSync: row.last_sync ? new Date(row.last_sync).toLocaleString() : 'Never',
    healthScore: Number(row.health_score || 0),
    apiStatus: row.status === 'connected' ? 'live' : row.status === 'error' ? 'offline' : 'offline',
    lastError: row.last_error || undefined,
    audienceNote: row.demographics?.note || undefined,
    canPublish: Boolean(row.can_publish),
    publishReadyNote: row.publish_ready_note || undefined,
  }));
}

export function navigateView(view: string, extra?: Record<string, string>) {
  const url = new URL(window.location.href);
  url.searchParams.set('view', view);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
  }
  window.history.pushState({}, '', url);
  window.dispatchEvent(new CustomEvent('gos:navigate', { detail: view }));
}

export const IANA_TIMEZONES = [
  { label: 'Africa/Lagos (WAT)', value: 'Africa/Lagos' },
  { label: 'Europe/London', value: 'Europe/London' },
  { label: 'America/New_York', value: 'America/New_York' },
  { label: 'America/Los_Angeles', value: 'America/Los_Angeles' },
  { label: 'Europe/Paris', value: 'Europe/Paris' },
  { label: 'Asia/Dubai', value: 'Asia/Dubai' },
  { label: 'Africa/Johannesburg', value: 'Africa/Johannesburg' },
];

export function timezoneFromPref(value?: string) {
  if (!value) return 'Africa/Lagos';
  if (value.includes('/')) return value;
  if (value.includes('WAT') || value.includes('UTC+0')) return 'Africa/Lagos';
  if (value.includes('EST')) return 'America/New_York';
  if (value.includes('PST')) return 'America/Los_Angeles';
  if (value.includes('CET')) return 'Europe/Paris';
  if (value.includes('GST')) return 'Asia/Dubai';
  return 'Africa/Lagos';
}

export function formatInZone(date: Date | string, timeZone: string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
