import { authFetch } from './authFetch';
import { readJsonOrThrow } from './httpJson';
import { supabase } from './supabase';

export type CalendarReadiness = {
  connected: boolean;
  accountName?: string;
  canPublish: boolean;
  note?: string;
};

export async function fetchCalendarReadiness(clientId: string): Promise<{
  instagram: CalendarReadiness;
  facebook: CalendarReadiness;
}> {
  const res = await authFetch(`/api/calendar/readiness?clientId=${encodeURIComponent(clientId)}`);
  const data = await readJsonOrThrow<{
    success?: boolean;
    error?: string;
    instagram?: CalendarReadiness;
    facebook?: CalendarReadiness;
  }>(res);
  if (!data.success) throw new Error(data.error || 'Could not load publish readiness.');
  return {
    instagram: data.instagram || { connected: false, canPublish: false },
    facebook: data.facebook || { connected: false, canPublish: false },
  };
}

export async function flushDuePosts(clientId?: string) {
  const res = await authFetch('/api/calendar/due', {
    method: 'POST',
    body: JSON.stringify(clientId ? { clientId } : {}),
  });
  const data = await readJsonOrThrow<{
    success?: boolean;
    error?: string;
    scanned: number;
    published: Array<Record<string, unknown>>;
    failed: Array<Record<string, unknown>>;
  }>(res);
  if (!data.success) throw new Error(data.error || 'Could not publish due posts.');
  return data as {
    scanned: number;
    published: Array<Record<string, unknown>>;
    failed: Array<Record<string, unknown>>;
  };
}

export async function publishCalendarItemNow(itemId: string) {
  const res = await authFetch(`/api/calendar/${encodeURIComponent(itemId)}/publish`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const data = await readJsonOrThrow<{
    success?: boolean;
    error?: string;
    providerPostId?: string;
    permalink?: string;
    accountLabel?: string;
    note?: string;
    alreadyPublished?: boolean;
  }>(res);
  if (!data.success) throw new Error(data.error || 'Publish failed.');
  return data as {
    providerPostId?: string;
    permalink?: string;
    accountLabel?: string;
    note?: string;
    alreadyPublished?: boolean;
  };
}

export async function uploadCalendarMedia(orgId: string, clientId: string, file: File) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80);
  const ext = safeName.includes('.') ? safeName.slice(safeName.lastIndexOf('.')) : '';
  const path = `${orgId}/${clientId}/${crypto.randomUUID()}${ext}`;
  const { error } = await supabase.storage.from('calendar-media').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('calendar-media').getPublicUrl(path);
  if (!data.publicUrl) throw new Error('Upload succeeded but no public URL was returned.');
  return {
    url: data.publicUrl,
    type: file.type.startsWith('video/') ? ('video' as const) : ('image' as const),
  };
}
