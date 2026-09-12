import {
  composeCaption,
  humanizeMetaPublishError,
  resolvePublishKind,
  type PublishKind,
} from '../../shared/calendarPublish';
import { listMetaBrandAssets, pickMetaAsset } from './providers';

const GRAPH = 'https://graph.facebook.com/v21.0';

type GraphError = Error & { code?: number; subcode?: number };

async function graph(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    const err = data?.error || {};
    const message = humanizeMetaPublishError(
      err.error_user_msg || err.message || `HTTP ${res.status}`,
      Number(err.code) || undefined,
      Number(err.error_subcode) || undefined
    );
    const wrapped: GraphError = new Error(message);
    wrapped.code = Number(err.code) || undefined;
    wrapped.subcode = Number(err.error_subcode) || undefined;
    throw wrapped;
  }
  return data;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type PublishTarget = {
  pageId: string;
  pageToken: string;
  pageName?: string;
  igId?: string;
  igUsername?: string;
};

export async function resolveMetaPublishTarget(
  userToken: string,
  platform: 'instagram' | 'facebook',
  extras?: { externalId?: string; clientName?: string }
): Promise<PublishTarget> {
  const { pages, assets } = await listMetaBrandAssets(userToken);
  const chosen = pickMetaAsset(assets, platform, extras);
  if (!chosen) {
    throw new Error(
      platform === 'instagram'
        ? 'TERMINAL: No Instagram professional account is bound to this brand. Connect Instagram and pick the brand account.'
        : 'TERMINAL: No Facebook Page is bound to this brand. Connect Facebook and pick the brand Page.'
    );
  }
  const page = pages.find((p) => p.id === chosen.pageId || p.id === chosen.id);
  if (!page?.access_token) {
    throw new Error(
      'TERMINAL: Meta did not return a Page access token. Reconnect with a login that has MANAGE or CREATE_CONTENT on this Page.'
    );
  }
  const ig = page.instagram_business_account;
  return {
    pageId: String(page.id),
    pageToken: String(page.access_token),
    pageName: page.name,
    igId: ig?.id || (chosen.kind === 'instagram' ? chosen.id : undefined),
    igUsername: ig?.username,
  };
}

async function assertInstagramQuota(igId: string, token: string) {
  try {
    const data = await graph(
      `${GRAPH}/${igId}/content_publishing_limit?fields=config,quota_usage&access_token=${encodeURIComponent(token)}`
    );
    const row = data?.data?.[0] || data;
    const used = Number(row?.quota_usage ?? 0);
    const quota = Number(row?.config?.quota_total ?? row?.config?.quota ?? 0);
    if (quota > 0 && used >= quota) {
      throw new Error(
        `Instagram’s content publishing limit is exhausted (${used}/${quota} in the current window). Try again after Meta resets the quota.`
      );
    }
  } catch (err: any) {
    if (String(err.message || '').includes('publishing limit')) throw err;
    console.warn('[publish] content_publishing_limit unavailable', err.message);
  }
}

async function pollContainer(containerId: string, token: string, timeoutMs = 42000) {
  const started = Date.now();
  let delay = 1500;
  while (Date.now() - started < timeoutMs) {
    const data = await graph(
      `${GRAPH}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`
    );
    const code = String(data.status_code || '').toUpperCase();
    if (code === 'FINISHED' || code === 'PUBLISHED') return data;
    if (code === 'ERROR') {
      throw new Error(data.status || 'Instagram rejected the media container.');
    }
    if (code === 'EXPIRED') {
      throw new Error('The Instagram media container expired. Upload the file again and retry.');
    }
    await sleep(delay);
    delay = Math.min(delay + 500, 4000);
  }
  const pending: Error & { containerPending?: boolean; containerId?: string } = new Error(
    'Instagram is still processing this media. GrowthOS will finish publishing on the next run.'
  );
  pending.containerPending = true;
  pending.containerId = containerId;
  throw pending;
}

async function createAndPublishIg(input: {
  igId: string;
  token: string;
  kind: Extract<PublishKind, 'ig_image' | 'ig_reel' | 'ig_story'>;
  mediaUrl: string;
  caption: string;
  existingContainerId?: string | null;
  onContainer?: (containerId: string) => Promise<void>;
  onPublished?: (providerPostId: string) => Promise<void>;
}) {
  await assertInstagramQuota(input.igId, input.token);
  let containerId = input.existingContainerId || '';
  if (containerId) {
    try {
      await pollContainer(containerId, input.token, 20000);
    } catch (err: any) {
      if (err.containerPending) throw err;
      containerId = '';
    }
  }
  if (!containerId) {
    const params = new URLSearchParams({ access_token: input.token });
    if (input.kind === 'ig_reel') {
      params.set('media_type', 'REELS');
      params.set('video_url', input.mediaUrl);
      params.set('caption', input.caption);
      params.set('share_to_feed', 'true');
    } else if (input.kind === 'ig_story') {
      params.set('media_type', 'STORIES');
      const video = /\.(mp4|mov|m4v)(\?|#|$)/i.test(input.mediaUrl);
      params.set(video ? 'video_url' : 'image_url', input.mediaUrl);
    } else {
      params.set('image_url', input.mediaUrl);
      params.set('caption', input.caption);
    }
    const created = await graph(`${GRAPH}/${input.igId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    containerId = String(created.id || '');
    if (!containerId) throw new Error('Instagram did not return a media container id.');
    await input.onContainer?.(containerId);
    try {
      await pollContainer(containerId, input.token);
    } catch (err: any) {
      if (err.containerPending) err.containerId = containerId;
      throw err;
    }
  }

  const published = await graph(`${GRAPH}/${input.igId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      creation_id: containerId,
      access_token: input.token,
    }),
  });
  const mediaId = String(published.id || '');
  if (!mediaId) throw new Error('Instagram accepted the container but did not return a media id.');
  await input.onPublished?.(mediaId);
  const permalink = await graph(
    `${GRAPH}/${mediaId}?fields=id,permalink&access_token=${encodeURIComponent(input.token)}`
  ).catch(() => ({ permalink: '' }));
  return {
    providerPostId: mediaId,
    permalink: String(permalink.permalink || ''),
    containerId,
  };
}

async function publishFacebook(input: {
  pageId: string;
  token: string;
  kind: Extract<PublishKind, 'fb_photo' | 'fb_video' | 'fb_text'>;
  mediaUrl?: string;
  caption: string;
}) {
  if (input.kind === 'fb_photo' && input.mediaUrl) {
    const created = await graph(`${GRAPH}/${input.pageId}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        url: input.mediaUrl,
        caption: input.caption,
        published: 'true',
        access_token: input.token,
      }),
    });
    const postId = String(created.post_id || created.id || '');
    const permalink = postId
      ? await graph(
          `${GRAPH}/${postId}?fields=permalink_url&access_token=${encodeURIComponent(input.token)}`
        ).catch(() => ({ permalink_url: '' }))
      : { permalink_url: '' };
    return { providerPostId: postId, permalink: String(permalink.permalink_url || '') };
  }

  if (input.kind === 'fb_video' && input.mediaUrl) {
    const created = await graph(`${GRAPH}/${input.pageId}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        file_url: input.mediaUrl,
        description: input.caption,
        access_token: input.token,
      }),
    });
    const videoId = String(created.id || '');
    return { providerPostId: videoId, permalink: videoId ? `https://www.facebook.com/${videoId}` : '' };
  }

  const created = await graph(`${GRAPH}/${input.pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      message: input.caption,
      access_token: input.token,
    }),
  });
  const postId = String(created.id || '');
  const permalink = postId
    ? await graph(
        `${GRAPH}/${postId}?fields=permalink_url&access_token=${encodeURIComponent(input.token)}`
      ).catch(() => ({ permalink_url: '' }))
    : { permalink_url: '' };
  return { providerPostId: postId, permalink: String(permalink.permalink_url || '') };
}

export async function publishCalendarItemToMeta(input: {
  platform: 'instagram' | 'facebook';
  contentType?: string;
  topic?: string;
  hookText?: string;
  captionText?: string;
  cta?: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  userToken: string;
  externalId?: string;
  clientName?: string;
  existingContainerId?: string | null;
  onContainer?: (containerId: string) => Promise<void>;
  onPublished?: (providerPostId: string) => Promise<void>;
}) {
  const resolved = resolvePublishKind({
    platform: input.platform,
    contentType: input.contentType,
    mediaType: input.mediaType,
    mediaUrl: input.mediaUrl,
    topic: input.topic,
    hookText: input.hookText,
    captionText: input.captionText,
    cta: input.cta,
  });
  if (!resolved.kind) throw new Error(resolved.error || 'This post cannot be published.');
  const caption = composeCaption(input);
  const target = await resolveMetaPublishTarget(input.userToken, input.platform, {
    externalId: input.externalId,
    clientName: input.clientName,
  });

  if (resolved.kind.startsWith('ig_')) {
    if (!target.igId) {
      throw new Error(
        'TERMINAL: The selected Facebook Page has no linked Instagram professional account.'
      );
    }
    const result = await createAndPublishIg({
      igId: target.igId,
      token: target.pageToken,
      kind: resolved.kind as 'ig_image' | 'ig_reel' | 'ig_story',
      mediaUrl: String(input.mediaUrl),
      caption,
      existingContainerId: input.existingContainerId,
      onContainer: input.onContainer,
      onPublished: input.onPublished,
    });
    return {
      ...result,
      accountLabel: target.igUsername ? `@${target.igUsername}` : target.pageName,
      note: resolved.note,
    };
  }

  const result = await publishFacebook({
    pageId: target.pageId,
    token: target.pageToken,
    kind: resolved.kind as 'fb_photo' | 'fb_video' | 'fb_text',
    mediaUrl: input.mediaUrl || undefined,
    caption,
  });
  await input.onPublished?.(result.providerPostId);
  return {
    ...result,
    containerId: undefined as string | undefined,
    accountLabel: target.pageName,
    note: resolved.note,
  };
}
