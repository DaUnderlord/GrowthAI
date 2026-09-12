export const META_IG_PUBLISH_SCOPE = 'instagram_content_publish';
export const META_PAGE_PUBLISH_SCOPE = 'pages_manage_posts';

export const META_INSTAGRAM_SCOPES = [
  'instagram_basic',
  'instagram_manage_insights',
  'instagram_content_publish',
  'pages_show_list',
  'pages_read_engagement',
  'pages_read_user_content',
  'pages_manage_posts',
  'ads_read',
  'business_management',
].join(',');

export const META_FACEBOOK_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_read_user_content',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_manage_insights',
  'instagram_content_publish',
  'ads_read',
  'business_management',
].join(',');

export type PublishKind = 'ig_image' | 'ig_reel' | 'ig_story' | 'fb_photo' | 'fb_video' | 'fb_text';

export function grantedScopesFromPermissions(
  payload?: { data?: Array<{ permission?: string; status?: string }> } | null
) {
  return (payload?.data || [])
    .filter((row) => String(row.status || '').toLowerCase() === 'granted' && row.permission)
    .map((row) => String(row.permission))
    .join(',');
}

export function parseScopeList(scopes?: string | null) {
  return String(scopes || '')
    .toLowerCase()
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function hasMetaPublishScopes(platform: string, scopes?: string | null) {
  const list = parseScopeList(scopes);
  if (platform === 'instagram') return list.includes(META_IG_PUBLISH_SCOPE);
  if (platform === 'facebook') return list.includes(META_PAGE_PUBLISH_SCOPE);
  return false;
}

export function publishReadyNote(platform: string, scopes?: string | null, connected = true) {
  if (platform !== 'instagram' && platform !== 'facebook') {
    return 'Calendar publishing is live for Instagram and Facebook Pages. This network stays insights-only for now.';
  }
  if (!connected) return `Connect the ${platform === 'instagram' ? 'Instagram professional' : 'Facebook Page'} account for this brand first.`;
  if (!hasMetaPublishScopes(platform, scopes)) {
    return 'This login is insights-only. Reconnect Meta and accept publishing so GrowthOS can post to the professional account.';
  }
  return '';
}

export function composeCaption(item: {
  topic?: string;
  hookText?: string;
  captionText?: string;
  cta?: string;
}) {
  const caption = String(item.captionText || '').trim();
  const hook = String(item.hookText || '').trim();
  const topic = String(item.topic || '').trim();
  const cta = String(item.cta || '').trim();
  const parts: string[] = [];
  if (caption) parts.push(caption);
  else if (hook) parts.push(hook);
  else if (topic) parts.push(topic);
  if (cta && !parts.join('\n').toLowerCase().includes(cta.toLowerCase())) {
    parts.push(cta);
  }
  return parts.join('\n\n').slice(0, 2200);
}

export function isPublicMediaUrl(url?: string | null): { ok: boolean; reason?: string } {
  const value = String(url || '').trim();
  if (!value) return { ok: false, reason: 'Add a public image or video first. Meta has to fetch it over https.' };
  if (value.startsWith('data:')) {
    return {
      ok: false,
      reason: 'Instagram and Facebook cannot fetch a local or base64 file. Upload it so it has a public https URL.',
    };
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') {
      return { ok: false, reason: 'Media must be an https URL that Meta can fetch.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Media URL is invalid.' };
  }
}

export function inferMediaKind(url?: string | null, declared?: string | null): 'image' | 'video' | 'unknown' {
  if (declared === 'video' || declared === 'image') return declared;
  const value = String(url || '').toLowerCase();
  if (/\.(mp4|mov|m4v|webm)(\?|#|$)/.test(value)) return 'video';
  if (/\.(jpe?g|png|gif|webp|bmp)(\?|#|$)/.test(value)) return 'image';
  return 'unknown';
}

export function resolvePublishKind(input: {
  platform: string;
  contentType?: string;
  mediaType?: string | null;
  mediaUrl?: string | null;
  topic?: string;
  hookText?: string;
  captionText?: string;
  cta?: string;
}): { kind?: PublishKind; error?: string; note?: string } {
  const platform = String(input.platform || '').toLowerCase();
  const contentType = String(input.contentType || '');
  const mediaKind = inferMediaKind(input.mediaUrl, input.mediaType);

  if (platform === 'tiktok' || platform === 'linkedin' || platform === 'youtube') {
    return {
      error: `${contentType || platform} stays on the calendar only. Live publishing is Instagram and Facebook Pages right now.`,
    };
  }
  if (platform !== 'instagram' && platform !== 'facebook') {
    return { error: `GrowthOS does not publish to ${platform} yet.` };
  }

  if (platform === 'instagram') {
    if (contentType === 'Story') {
      const media = isPublicMediaUrl(input.mediaUrl);
      if (!media.ok) return { error: media.reason };
      return { kind: 'ig_story' };
    }
    if (contentType === 'Reel' || contentType === 'Shorts') {
      if (mediaKind !== 'video') {
        return { error: 'Reels need a public MP4 or MOV. Upload a video, or change the format to a photo post.' };
      }
      const media = isPublicMediaUrl(input.mediaUrl);
      if (!media.ok) return { error: media.reason };
      return { kind: 'ig_reel' };
    }
    const media = isPublicMediaUrl(input.mediaUrl);
    if (!media.ok) return { error: media.reason };
    if (mediaKind === 'video') return { kind: 'ig_reel' };
    return {
      kind: 'ig_image',
      note:
        contentType === 'Carousel'
          ? 'Published as a single Instagram image. Multi-image carousels need more than one public file.'
          : undefined,
    };
  }

  if (mediaKind === 'video') {
    const media = isPublicMediaUrl(input.mediaUrl);
    if (!media.ok) return { error: media.reason };
    return { kind: 'fb_video' };
  }
  if (input.mediaUrl) {
    const media = isPublicMediaUrl(input.mediaUrl);
    if (!media.ok) return { error: media.reason };
    return { kind: 'fb_photo' };
  }
  const caption = composeCaption(input);
  if (!caption) return { error: 'Facebook needs a caption or a public image.' };
  return { kind: 'fb_text' };
}

export function isTerminalPublishError(message?: string | null) {
  const text = String(message || '');
  return /reconnect|insights-only|not connected|missing.*media|cannot fetch|base64|does not publish|stays on the calendar|CREATE_CONTENT|Page Publishing Authorization|two-factor|two factor|App Review|#10\b|#200\b|invalid.*url|Reels need a public/i.test(
    text
  );
}

export function humanizeMetaPublishError(message: string, code?: number, subcode?: number) {
  const raw = message || 'Meta rejected the publish request.';
  if (code === 190) return `TERMINAL: Meta login expired. Reconnect the brand account. (${raw})`;
  if (code === 10 || code === 200) {
    return `TERMINAL: This login cannot publish. Reconnect Meta, accept publishing, and make sure the Page role is MANAGE or CREATE_CONTENT. (${raw})`;
  }
  if (code === 4 || code === 17 || code === 32 || code === 613) {
    return `Meta rate-limited this app. Wait and try again. (${raw})`;
  }
  if (code === 80004 || /content publishing limit/i.test(raw)) {
    return `Instagram’s daily publishing limit was reached for this professional account. (${raw})`;
  }
  if (code === 9007 || /media download/i.test(raw)) {
    return `Instagram could not fetch the media URL. It must be publicly reachable over https. (${raw})`;
  }
  if (/two-factor|two factor|publishing authorization|PPA/i.test(raw) || subcode === 458) {
    return `TERMINAL: Facebook Page publishing is blocked by Page Publishing Authorization or 2FA. Complete that in Meta Business Suite, then retry. (${raw})`;
  }
  return raw;
}

function zoneClock(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(read('year'), read('month') - 1, read('day'), read('hour'), read('minute'), read('second'));
}

function zoneOffsetMs(instant: number, timeZone: string) {
  return zoneClock(instant, timeZone) - instant;
}

export function scheduledAtIso(date: string, time: string, timeZone = 'Africa/Lagos') {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || '').trim());
  const timeMatch = /^(\d{1,2}):(\d{2})/.exec(String(time || '12:00').trim());
  if (!dateMatch) return null;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch?.[1] || 12);
  const minute = Number(timeMatch?.[2] || 0);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  let instant = utcGuess - zoneOffsetMs(utcGuess, timeZone);
  instant = utcGuess - zoneOffsetMs(instant, timeZone);
  return new Date(instant).toISOString();
}

export function todayInZone(timeZone = 'Africa/Lagos') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const read = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${read('year')}-${read('month')}-${read('day')}`;
}

export function dayNameForDate(date: string, timeZone = 'Africa/Lagos') {
  const iso = scheduledAtIso(date, '12:00', timeZone);
  if (!iso) return 'Monday';
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone }).format(new Date(iso));
}
