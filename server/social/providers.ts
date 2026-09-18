export type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'linkedin'
  | 'youtube'
  | 'google_analytics'
  | 'meta_ads'
  | 'google_ads';

import { allowedOAuthOrigins, getAppUrl } from '../appUrl';
import type { ProviderFamily } from '../orgIntegrations';
import {
  META_FACEBOOK_SCOPES,
  META_INSTAGRAM_SCOPES,
  grantedScopesFromPermissions,
  hasMetaPublishScopes,
} from '../../shared/calendarPublish';

export type ProviderOverrideMap = Partial<
  Record<ProviderFamily, { clientId: string; secret: string; extra?: Record<string, string> }>
>;

export type LiveStats = {
  accountName: string;
  externalId?: string;
  adAccountId?: string;
  followers: number;
  growthRate: number;
  healthScore: number;
  impressions24h: number;
  reach24h: number;
  engagement24h: number;
  clicks24h: number;
  spend30d: number;
  conversions30d: number;
  revenue30d: number;
  posts?: Array<Record<string, unknown>>;
  demographics?: Record<string, unknown>;
  trends?: Array<Record<string, unknown>>;
};

function originFromHeader(raw?: string | null) {
  if (!raw) return '';
  try {
    return new URL(raw).origin;
  } catch {
    return '';
  }
}

export function resolveOAuthRedirectUri(
  requested?: string | null,
  originHeader?: string | null,
  referer?: string | null
) {
  const requestOrigin = originFromHeader(originHeader) || originFromHeader(referer);
  const requestedUri = sanitizeCallback(requested);
  const originUri = requestOrigin ? sanitizeCallback(`${requestOrigin}/auth/callback`) : '';
  const appUri = `${getAppUrl()}/auth/callback`;

  let chosen = originUri || appUri;
  if (requestedUri) {
    const requestedOrigin = originFromHeader(requestedUri);
    if (requestOrigin && requestedOrigin === requestOrigin) chosen = requestedUri;
    else if (requestedOrigin && allowedOAuthOrigins().has(requestedOrigin)) chosen = requestedUri;
  }

  console.info('[oauth] resolve redirect', {
    requested: requestedUri || null,
    originHeader: originHeader || null,
    referer: referer || null,
    chosen,
  });
  return chosen;
}

function sanitizeCallback(raw?: string | null) {
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    const path = url.pathname.replace(/\/$/, '');
    if (path === '' || path === '/') return `${url.origin}/auth/callback`;
    if (path.endsWith('/auth/callback')) return `${url.origin}/auth/callback`;
    return '';
  } catch {
    return '';
  }
}

function familyOf(platform: string): ProviderFamily {
  if (platform === 'tiktok') return 'tiktok';
  if (platform === 'linkedin') return 'linkedin';
  if (platform === 'youtube' || platform === 'google_analytics' || platform === 'google_ads') return 'google';
  return 'meta';
}

export function providerConfig(
  platform: string,
  overrides?: ProviderOverrideMap,
  redirectUri = resolveOAuthRedirectUri()
) {
  const meta = overrides?.meta;
  const google = overrides?.google;
  const tiktok = overrides?.tiktok;
  const linkedin = overrides?.linkedin;
  const metaId = meta?.clientId || process.env.META_CLIENT_ID || process.env.META_APP_ID || '';
  const metaSecret = meta?.secret || process.env.META_APP_SECRET || '';
  const googleId = google?.clientId || process.env.GOOGLE_CLIENT_ID || '';
  const googleSecret = google?.secret || process.env.GOOGLE_CLIENT_SECRET || '';
  const linkedInId = linkedin?.clientId || process.env.LINKEDIN_CLIENT_ID || '';
  const linkedInSecret = linkedin?.secret || process.env.LINKEDIN_CLIENT_SECRET || '';
  const tiktokKey = tiktok?.clientId || process.env.TIKTOK_CLIENT_KEY || '';
  const tiktokSecret = tiktok?.secret || process.env.TIKTOK_CLIENT_SECRET || '';

  const map: Record<string, { authorizeUrl: string; clientId: string; secret: string; scopes: string; configured: boolean }> = {
    instagram: {
      authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
      clientId: metaId,
      secret: metaSecret,
      scopes: META_INSTAGRAM_SCOPES,
      configured: Boolean(metaId && metaSecret),
    },
    facebook: {
      authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
      clientId: metaId,
      secret: metaSecret,
      scopes: META_FACEBOOK_SCOPES,
      configured: Boolean(metaId && metaSecret),
    },
    meta_ads: {
      authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
      clientId: metaId,
      secret: metaSecret,
      scopes: 'ads_read,ads_management,business_management,pages_show_list',
      configured: Boolean(metaId && metaSecret),
    },
    youtube: {
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      clientId: googleId,
      secret: googleSecret,
      scopes: 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly',
      configured: Boolean(googleId && googleSecret),
    },
    google_analytics: {
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      clientId: googleId,
      secret: googleSecret,
      scopes: 'https://www.googleapis.com/auth/analytics.readonly',
      configured: Boolean(googleId && googleSecret),
    },
    google_ads: {
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      clientId: googleId,
      secret: googleSecret,
      scopes: 'https://www.googleapis.com/auth/adwords',
      configured: Boolean(googleId && googleSecret),
    },
    linkedin: {
      authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
      clientId: linkedInId,
      secret: linkedInSecret,
      scopes: 'openid profile email r_organization_social rw_organization_admin',
      configured: Boolean(linkedInId && linkedInSecret),
    },
    tiktok: {
      authorizeUrl: 'https://www.tiktok.com/v2/auth/authorize/',
      clientId: tiktokKey,
      secret: tiktokSecret,
      scopes: 'user.info.basic,user.info.stats,video.list',
      configured: Boolean(tiktokKey && tiktokSecret),
    },
  };

  const config = map[platform];
  if (!config) throw new Error(`Unsupported platform: ${platform}`);
  return { ...config, redirectUri };
}

export function isLikelyMetaAppId(id: string) {
  return /^\d{5,20}$/.test(String(id || '').trim());
}

/** Facebook Login for Business configuration IDs are numeric, like App IDs. */
export function isLikelyMetaConfigId(id: string) {
  return /^\d{5,24}$/.test(String(id || '').trim());
}

function metaLoginConfigId(overrides?: ProviderOverrideMap) {
  return String(overrides?.meta?.extra?.configId || process.env.META_CONFIG_ID || '').trim();
}

export function buildAuthorizeUrl(
  platform: string,
  state: string,
  overrides?: ProviderOverrideMap,
  redirectUri?: string
) {
  const config = providerConfig(platform, overrides, redirectUri);
  if (!config.configured) {
    const family = familyOf(platform);
    throw new Error(
      `${platform} is not connected yet. Add your ${family} app credentials under Sign in, then try again.`
    );
  }
  if (
    (platform === 'instagram' || platform === 'facebook' || platform === 'meta_ads') &&
    !isLikelyMetaAppId(config.clientId)
  ) {
    throw new Error(
      'Meta App ID must be the numeric ID from developers.facebook.com/apps — not an Instagram @handle or Page name. Save that App ID under Sign in, then try again.'
    );
  }
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    state,
  });
  const isMeta = platform === 'instagram' || platform === 'facebook' || platform === 'meta_ads';
  if (isMeta) {
    const configId = metaLoginConfigId(overrides);
    if (!configId) {
      throw new Error(
        'Facebook Login for Business needs a Configuration ID. In your Meta app open Facebook Login for Business → Configurations, create one that includes Instagram insights/publish and Page publishing, then save that ID under Sign in.'
      );
    }
    if (!isLikelyMetaConfigId(configId)) {
      throw new Error(
        'Configuration ID must be the numeric ID from Facebook Login for Business → Configurations — not an App Secret or Instagram handle.'
      );
    }
    params.set('config_id', configId);
    params.set('override_default_response_type', 'true');
    params.set('display', 'popup');
    console.info('[oauth] meta authorize using login-for-business', {
      platform,
      hasScope: false,
      hasConfigId: true,
      configIdLen: configId.length,
      display: 'popup',
    });
  } else {
    params.set('scope', config.scopes);
  }
  if (platform === 'youtube' || platform === 'google_analytics' || platform === 'google_ads') {
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
    params.set('include_granted_scopes', 'true');
  }
  if (platform === 'tiktok') {
    params.set('client_key', config.clientId);
  }
  return `${config.authorizeUrl}?${params.toString()}`;
}

export async function fetchGrantedMetaScopes(token: string) {
  const payload = await jsonFetch(
    `https://graph.facebook.com/v21.0/me/permissions?access_token=${encodeURIComponent(token)}`
  );
  const granted = grantedScopesFromPermissions(payload);
  console.info('[oauth] granted meta scopes', {
    count: granted ? granted.split(',').length : 0,
    instagramPublish: hasMetaPublishScopes('instagram', granted),
    facebookPublish: hasMetaPublishScopes('facebook', granted),
  });
  return granted;
}

async function jsonFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.error_description || data?.message || `HTTP ${res.status}`);
  }
  return data;
}

export async function exchangeCodeForToken(
  platform: string,
  code: string,
  overrides?: ProviderOverrideMap,
  redirectUri?: string
) {
  const config = providerConfig(platform, overrides, redirectUri);
  if (platform === 'instagram' || platform === 'facebook' || platform === 'meta_ads') {
    const short = await jsonFetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?${new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.secret,
        redirect_uri: config.redirectUri,
        code,
      })}`
    );
    const longLived = await jsonFetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?${new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: config.clientId,
        client_secret: config.secret,
        fb_exchange_token: short.access_token,
      })}`
    ).catch(() => short);
    const accessToken = longLived.access_token as string;
    const granted = await fetchGrantedMetaScopes(accessToken).catch((err: any) => {
      console.warn('[oauth] could not read granted Meta permissions', err.message);
      return '';
    });
    return {
      accessToken,
      refreshToken: undefined as string | undefined,
      expiresAt: longLived.expires_in
        ? new Date(Date.now() + Number(longLived.expires_in) * 1000).toISOString()
        : null,
      scopes: granted,
    };
  }

  if (platform === 'youtube' || platform === 'google_analytics' || platform === 'google_ads') {
    const token = await jsonFetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.secret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    return {
      accessToken: token.access_token as string,
      refreshToken: token.refresh_token as string | undefined,
      expiresAt: token.expires_in
        ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString()
        : null,
      scopes: config.scopes,
    };
  }

  if (platform === 'linkedin') {
    const token = await jsonFetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.secret,
      }),
    });
    return {
      accessToken: token.access_token as string,
      refreshToken: token.refresh_token as string | undefined,
      expiresAt: token.expires_in
        ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString()
        : null,
      scopes: config.scopes,
    };
  }

  if (platform === 'tiktok') {
    const token = await jsonFetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: config.clientId,
        client_secret: config.secret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: config.redirectUri,
      }),
    });
    const payload = token.data || token;
    return {
      accessToken: payload.access_token as string,
      refreshToken: payload.refresh_token as string | undefined,
      expiresAt: payload.expires_in
        ? new Date(Date.now() + Number(payload.expires_in) * 1000).toISOString()
        : null,
      scopes: config.scopes,
    };
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

function scoreFromRates(engagementRate: number, growth: number) {
  return Math.max(0, Math.min(100, Math.round(engagementRate * 800 + growth * 2 + 40)));
}

export type MetaBrandAsset = {
  kind: 'instagram' | 'facebook' | 'ad_account';
  id: string;
  name: string;
  pageId?: string;
  pageName?: string;
  followers?: number;
};

export async function fetchLiveStats(
  platform: string,
  accessToken: string,
  extras?: Record<string, string>
): Promise<LiveStats> {
  if (platform === 'instagram' || platform === 'facebook' || platform === 'meta_ads') {
    return fetchMetaStats(platform, accessToken, extras);
  }
  if (platform === 'youtube') return fetchYouTubeStats(accessToken);
  if (platform === 'google_analytics') return fetchGaStats(accessToken);
  if (platform === 'google_ads') return fetchGoogleAdsStats(accessToken, extras);
  if (platform === 'linkedin') return fetchLinkedInStats(accessToken);
  if (platform === 'tiktok') return fetchTikTokStats(accessToken);
  throw new Error(`Unsupported platform: ${platform}`);
}

async function graphPaged(url: string) {
  const rows: any[] = [];
  let next: string | undefined = url;
  let hops = 0;
  while (next && hops < 8) {
    const payload = await jsonFetch(next);
    rows.push(...(payload.data || []));
    next = payload.paging?.next;
    hops += 1;
  }
  return rows;
}

export async function listMetaBrandAssets(token: string): Promise<{ pages: any[]; assets: MetaBrandAsset[] }> {
  const seen = new Map<string, any>();
  const addPage = (page: any) => {
    if (page?.id && !seen.has(page.id)) seen.set(page.id, page);
  };

  const mine = await graphPaged(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,followers_count}&limit=100&access_token=${encodeURIComponent(token)}`
  ).catch((err: any) => {
    console.error('[meta] me/accounts failed', err.message);
    return [];
  });
  mine.forEach(addPage);

  const businesses = await graphPaged(
    `https://graph.facebook.com/v21.0/me/businesses?fields=id,name&limit=50&access_token=${encodeURIComponent(token)}`
  ).catch((err: any) => {
    console.error('[meta] me/businesses failed', err.message);
    return [];
  });
  for (const biz of businesses) {
    for (const edge of ['owned_pages', 'client_pages']) {
      const extra = await graphPaged(
        `https://graph.facebook.com/v21.0/${biz.id}/${edge}?fields=id,name,access_token,instagram_business_account{id,username,followers_count}&limit=100&access_token=${encodeURIComponent(token)}`
      ).catch((err: any) => {
        console.error(`[meta] ${edge} failed for ${biz.id}`, err.message);
        return [];
      });
      extra.forEach(addPage);
    }
  }

  const pages = [...seen.values()];
  const assets: MetaBrandAsset[] = [];
  for (const page of pages) {
    assets.push({ kind: 'facebook', id: page.id, name: page.name, pageId: page.id, pageName: page.name });
    const ig = page.instagram_business_account;
    if (ig?.id) {
      assets.push({
        kind: 'instagram',
        id: ig.id,
        name: ig.username ? `@${ig.username}` : page.name,
        pageId: page.id,
        pageName: page.name,
        followers: Number(ig.followers_count || 0),
      });
    }
  }
  const adActs = await graphPaged(
    `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status&limit=50&access_token=${encodeURIComponent(token)}`
  ).catch(() => []);
  for (const act of adActs) {
    assets.push({ kind: 'ad_account', id: act.id, name: act.name || act.id });
  }
  console.info('[meta] listed brand assets', {
    pages: pages.length,
    instagram: assets.filter((a) => a.kind === 'instagram').length,
    adAccounts: adActs.length,
  });
  return { pages, assets };
}

export function pickMetaAsset(assets: MetaBrandAsset[], platform: string, extras?: Record<string, string>) {
  const kind = platform === 'meta_ads' ? 'ad_account' : platform === 'instagram' ? 'instagram' : 'facebook';
  const pool = assets.filter((a) => a.kind === kind);
  if (extras?.externalId) {
    return pool.find((a) => a.id === extras.externalId) || assets.find((a) => a.id === extras.externalId) || null;
  }
  const needle = (extras?.clientName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (needle) {
    const named = pool.find((a) => {
      const hay = `${a.name} ${a.pageName || ''}`.toLowerCase().replace(/[^a-z0-9]/g, '');
      return hay.includes(needle) || needle.includes(hay.replace('@', ''));
    });
    if (named) return named;
  }
  return pool.length === 1 ? pool[0] : null;
}

async function fetchMetaStats(platform: string, token: string, extras?: Record<string, string>): Promise<LiveStats> {
  const { pages, assets } = await listMetaBrandAssets(token);
  const chosen = pickMetaAsset(assets, platform, extras);
  if (!chosen) {
    const available = assets.filter((a) =>
      platform === 'instagram' ? a.kind === 'instagram' : platform === 'meta_ads' ? a.kind === 'ad_account' : a.kind === 'facebook'
    );
    const err: any = new Error(
      available.length
        ? `This login can manage ${available.length} brand accounts. Select the ${platform.replace('_', ' ')} account for this client.`
        : platform === 'instagram'
          ? 'This Meta login has no Instagram professional account. In Meta Business Suite, link the brand IG account to its Facebook Page, then sign in again.'
          : platform === 'meta_ads'
            ? 'This Meta login has no ad accounts. Add the brand ad account in Business Manager, then sign in again.'
            : 'This Meta login has no Facebook Pages. Add the brand Page in Business Manager (owned or client Page), then sign in again.'
    );
    err.code = 'NEEDS_SELECTION';
    err.assets = available.map(({ id, name, kind, pageName, followers }) => ({ id, name, kind, pageName, followers }));
    throw err;
  }

  const page = pages.find((p) => p.id === chosen.pageId || p.id === chosen.id);
  const pageToken = page?.access_token || token;
  console.info('[meta] selected brand asset', { platform, id: chosen.id, name: chosen.name, pageId: chosen.pageId });

  if (platform === 'instagram' || chosen.kind === 'instagram') {
    const igId = chosen.kind === 'instagram' ? chosen.id : page?.instagram_business_account?.id;
    if (!igId) {
      throw new Error('The selected Page has no linked Instagram professional account.');
    }
    return fetchInstagramProfessional(igId, pageToken, page?.name);
  }

  const pageId = chosen.pageId || chosen.id;
  const pageInfo = await jsonFetch(
    `https://graph.facebook.com/v21.0/${pageId}?fields=name,fan_count&access_token=${encodeURIComponent(pageToken)}`
  );
  let ads = { spend: 0, clicks: 0, impressions: 0, conversions: 0, revenue: 0, adAccountId: extras?.adAccountId || '' };
  if (platform === 'meta_ads' || platform === 'facebook') {
    const act = extras?.adAccountId
      ? { id: extras.adAccountId }
      : assets.find((a) => a.kind === 'ad_account');
    if (act?.id) {
      const insights = await jsonFetch(
        `https://graph.facebook.com/v21.0/${act.id}/insights?fields=spend,impressions,clicks,actions,action_values&date_preset=last_30d&access_token=${encodeURIComponent(token)}`
      ).catch(() => ({ data: [] }));
      const row = insights.data?.[0] || {};
      ads = {
        spend: Number(row.spend || 0),
        clicks: Number(row.clicks || 0),
        impressions: Number(row.impressions || 0),
        conversions: Number(
          (row.actions || []).find((a: any) => /purchase|lead|offsite_conversion/i.test(a.action_type))?.value || 0
        ),
        revenue: Number((row.action_values || []).find((a: any) => /purchase/i.test(a.action_type))?.value || 0),
        adAccountId: act.id,
      };
    }
  }

  const linkedIg = page?.instagram_business_account;
  const igDemo = linkedIg?.id
    ? await fetchInstagramDemographics(linkedIg.id, pageToken, Number(linkedIg.followers_count || 0))
    : null;
  const adsDemo = ads.adAccountId
    ? await fetchAdsDemographics(ads.adAccountId, token)
    : { adsAgeGender: {} as Record<string, number> };
  const hasAudience = Boolean(
    Object.keys(igDemo?.ageGender || {}).length || Object.keys(adsDemo.adsAgeGender || {}).length
  );
  console.info('[meta] facebook audience sources', {
    pageId,
    igId: linkedIg?.id || null,
    igSegments: Object.keys(igDemo?.ageGender || {}).length,
    adsSegments: Object.keys(adsDemo.adsAgeGender || {}).length,
  });
  const demographics = {
    ...(igDemo || {}),
    ...adsDemo,
    source: igDemo?.ageGender && Object.keys(igDemo.ageGender).length ? 'instagram_insights' : adsDemo.adsAgeGender && Object.keys(adsDemo.adsAgeGender).length ? 'meta_ads_insights' : 'facebook_page',
    note: hasAudience
      ? undefined
      : 'Meta removed Page fan age/gender Insights. Audience comes from the linked Instagram professional account or Ads Insights. Connect Instagram or a Meta ad account for this brand.',
  };
  return {
    accountName: pageInfo.name || chosen.name,
    externalId: pageId,
    adAccountId: ads.adAccountId || undefined,
    followers: Number(pageInfo.fan_count || 0),
    growthRate: 0,
    healthScore: ads.impressions ? 78 : 70,
    impressions24h: ads.impressions ? Math.round(ads.impressions / 30) : 0,
    reach24h: ads.impressions ? Math.round(ads.impressions / 30) : 0,
    engagement24h: ads.clicks ? Math.round(ads.clicks / 30) : 0,
    clicks24h: ads.clicks ? Math.round(ads.clicks / 30) : 0,
    spend30d: ads.spend,
    conversions30d: ads.conversions,
    revenue30d: ads.revenue,
    demographics,
  };
}

async function fetchInstagramProfessional(igId: string, pageToken: string, pageName?: string): Promise<LiveStats> {
  const ig = await jsonFetch(
    `https://graph.facebook.com/v21.0/${igId}?fields=username,followers_count,media_count&access_token=${encodeURIComponent(pageToken)}`
  );
  let insights = await jsonFetch(
    `https://graph.facebook.com/v21.0/${igId}/insights?metric=impressions,reach,profile_views&period=day&access_token=${encodeURIComponent(pageToken)}`
  ).catch(() => ({ data: [] }));
  if (!insights.data?.length) {
    insights = await jsonFetch(
      `https://graph.facebook.com/v21.0/${igId}/insights?metric=views,reach,profile_views&period=day&access_token=${encodeURIComponent(pageToken)}`
    ).catch(() => ({ data: [] }));
  }
  const media = await jsonFetch(
    `https://graph.facebook.com/v21.0/${igId}/media?fields=id,caption,timestamp,like_count,comments_count,insights.metric(impressions,reach,saved,shares)&limit=8&access_token=${encodeURIComponent(pageToken)}`
  ).catch(() => ({ data: [] }));
  const metric = (name: string) =>
    Number(insights.data?.find((m: any) => m.name === name)?.values?.slice(-1)?.[0]?.value || 0);
  const impressions = metric('impressions') || metric('views');
  const posts = (media.data || []).map((m: any) => ({
    id: m.id,
    title: (m.caption || 'Instagram post').slice(0, 80),
    platform: 'instagram',
    postDate: (m.timestamp || '').slice(0, 10),
    likes: m.like_count || 0,
    comments: m.comments_count || 0,
    impressions: Number(m.insights?.data?.find((i: any) => i.name === 'impressions')?.values?.[0]?.value || 0),
    reach: Number(m.insights?.data?.find((i: any) => i.name === 'reach')?.values?.[0]?.value || 0),
    saves: Number(m.insights?.data?.find((i: any) => i.name === 'saved')?.values?.[0]?.value || 0),
    shares: Number(m.insights?.data?.find((i: any) => i.name === 'shares')?.values?.[0]?.value || 0),
  }));
  const engagement = posts.reduce((s: number, p: any) => s + p.likes + p.comments + p.saves, 0);
  const followers = Number(ig.followers_count || 0);
  return {
    accountName: `@${ig.username || pageName || 'instagram'}`,
    externalId: igId,
    followers,
    growthRate: 0,
    healthScore: scoreFromRates(followers ? engagement / Math.max(followers, 1) : 0, 0),
    impressions24h: impressions,
    reach24h: metric('reach') || impressions,
    engagement24h: engagement,
    clicks24h: 0,
    spend30d: 0,
    conversions30d: 0,
    revenue30d: 0,
    posts,
    demographics: await fetchInstagramDemographics(igId, pageToken, followers),
  };
}

function collectBreakdown(metric: any, into: Record<string, number>) {
  for (const row of metric.total_value?.breakdowns?.[0]?.results || []) {
    const key =
      (row.dimension_values || [])
        .filter((value: string) => value && !/DAYS|MONTH|WEEK/i.test(value))
        .join(' · ') || 'unknown';
    into[key] = (into[key] || 0) + Number(row.value || 0);
  }
  const values = metric.values?.[0]?.value;
  if (values && typeof values === 'object' && !Array.isArray(values)) {
    for (const [key, value] of Object.entries(values)) into[key] = Number(value || 0);
  }
}

async function fetchIgBreakdown(igId: string, token: string, metric: string, breakdown: string) {
  const queries = [
    `metric=${metric}&period=lifetime&metric_type=total_value&timeframe=this_month&breakdown=${breakdown}`,
    `metric=${metric}&period=lifetime&metric_type=total_value&timeframe=this_week&breakdown=${breakdown}`,
  ];
  let lastError = '';
  for (const query of queries) {
    const payload = await jsonFetch(
      `https://graph.facebook.com/v21.0/${igId}/insights?${query}&access_token=${encodeURIComponent(token)}`
    ).catch((err: any) => {
      lastError = err.message;
      return { data: [] };
    });
    const into: Record<string, number> = {};
    for (const row of payload.data || []) collectBreakdown(row, into);
    if (Object.keys(into).length) return { into, error: '' };
  }
  return { into: {} as Record<string, number>, error: lastError };
}

async function fetchInstagramDemographics(igId: string, token: string, followers = 0) {
  const ageGender: Record<string, number> = {};
  const countries: Record<string, number> = {};
  const cities: Record<string, number> = {};
  let lastError = '';

  for (const metric of ['follower_demographics', 'engaged_audience_demographics', 'reached_audience_demographics']) {
    const age = await fetchIgBreakdown(igId, token, metric, 'age');
    const gender = await fetchIgBreakdown(igId, token, metric, 'gender');
    const country = await fetchIgBreakdown(igId, token, metric, 'country');
    const city = await fetchIgBreakdown(igId, token, metric, 'city');
    lastError = age.error || gender.error || country.error || lastError;
    Object.assign(ageGender, age.into, gender.into);
    Object.assign(countries, country.into);
    Object.assign(cities, city.into);
    if (Object.keys(ageGender).length) {
      console.info('[meta] ig demographics', { igId, metric, ages: Object.keys(age.into).length, genders: Object.keys(gender.into).length });
      break;
    }
  }

  return {
    source: 'instagram_insights',
    ageGender,
    countries,
    cities,
    note: Object.keys(ageGender).length
      ? undefined
      : lastError ||
        (followers > 0 && followers < 100
          ? 'Meta withholds follower age/gender until the professional account has at least 100 followers.'
          : 'Meta returned no age/gender for this professional account. Confirm instagram_manage_insights is granted and Insights is available in Meta Business Suite.'),
  };
}

async function fetchAdsDemographics(adAccountId: string, token: string) {
  const insights = await jsonFetch(
    `https://graph.facebook.com/v21.0/${adAccountId}/insights?fields=impressions&breakdowns=age,gender&date_preset=last_30d&access_token=${encodeURIComponent(token)}`
  ).catch(() => ({ data: [] }));
  const ageGender: Record<string, number> = {};
  for (const row of insights.data || []) {
    const key = [row.gender, row.age].filter(Boolean).join('.');
    if (key) ageGender[key] = Number(row.impressions || 0);
  }
  return { adsAgeGender: ageGender };
}

async function fetchYouTubeStats(token: string): Promise<LiveStats> {
  const channels = await jsonFetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const ch = channels.items?.[0];
  if (!ch) throw new Error('No YouTube channel on this Google account.');
  const subs = Number(ch.statistics?.subscriberCount || 0);
  const views = Number(ch.statistics?.viewCount || 0);
  return {
    accountName: ch.snippet?.title || 'YouTube',
    externalId: ch.id,
    followers: subs,
    growthRate: 0,
    healthScore: subs > 0 ? 74 : 50,
    impressions24h: Math.round(views / 365),
    reach24h: Math.round(views / 365),
    engagement24h: 0,
    clicks24h: 0,
    spend30d: 0,
    conversions30d: 0,
    revenue30d: 0,
  };
}

async function fetchGaStats(token: string): Promise<LiveStats> {
  const accounts = await jsonFetch(
    'https://analyticsadmin.googleapis.com/v1beta/accountSummaries',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const property = accounts.accountSummaries?.[0]?.propertySummaries?.[0]?.property;
  if (!property) throw new Error('No GA4 property found on this Google account.');
  const report = await jsonFetch(`https://analyticsdata.googleapis.com/v1beta/${property}:runReport`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'screenPageViews' },
        { name: 'conversions' },
        { name: 'totalRevenue' },
      ],
    }),
  });
  const values = report.rows?.[0]?.metricValues || [];
  const sessions = Number(values[0]?.value || 0);
  const users = Number(values[1]?.value || 0);
  const views = Number(values[2]?.value || 0);
  const conversions = Number(values[3]?.value || 0);
  const revenue = Number(values[4]?.value || 0);
  return {
    accountName: property,
    externalId: property,
    followers: users,
    growthRate: 0,
    healthScore: sessions ? 80 : 50,
    impressions24h: Math.round(views / 28),
    reach24h: Math.round(users / 28),
    engagement24h: Math.round(sessions / 28),
    clicks24h: Math.round(sessions / 28),
    spend30d: 0,
    conversions30d: conversions,
    revenue30d: revenue,
  };
}

async function resolveGoogleAdsCustomerId(token: string, devToken: string, preferred?: string) {
  const chosen = (preferred || '').replace(/-/g, '');
  if (chosen) return chosen;
  const res = await fetch('https://googleads.googleapis.com/v18/customers:listAccessibleCustomers', {
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': devToken,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Could not list Google Ads accounts.');
  const first = (data.resourceNames || [])[0] as string | undefined;
  if (!first) throw new Error('This Google account has no accessible Ads customers.');
  return first.replace('customers/', '');
}

async function fetchGoogleAdsStats(token: string, extras?: Record<string, string>): Promise<LiveStats> {
  const devToken = extras?.developerToken || process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!devToken) {
    throw new Error(
      'Google requires a developer token for Ads. Paste yours in Settings → Integrations (Google), then sync again.'
    );
  }
  const customerId = await resolveGoogleAdsCustomerId(token, devToken, extras?.customerId || process.env.GOOGLE_ADS_CUSTOMER_ID);
  const query =
    'SELECT metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM customer WHERE segments.date DURING LAST_30_DAYS';
  const res = await fetch(`https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:searchStream`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': devToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Google Ads query failed');
  const rows = Array.isArray(data) ? data.flatMap((b: any) => b.results || []) : data.results || [];
  const totals = rows.reduce(
    (acc: any, row: any) => {
      acc.impressions += Number(row.metrics?.impressions || 0);
      acc.clicks += Number(row.metrics?.clicks || 0);
      acc.cost += Number(row.metrics?.costMicros || 0) / 1_000_000;
      acc.conversions += Number(row.metrics?.conversions || 0);
      acc.revenue += Number(row.metrics?.conversionsValue || 0);
      return acc;
    },
    { impressions: 0, clicks: 0, cost: 0, conversions: 0, revenue: 0 }
  );
  return {
    accountName: `Google Ads ${customerId}`,
    externalId: customerId,
    adAccountId: customerId,
    followers: 0,
    growthRate: 0,
    healthScore: totals.impressions ? 76 : 40,
    impressions24h: Math.round(totals.impressions / 30),
    reach24h: Math.round(totals.impressions / 30),
    engagement24h: Math.round(totals.clicks / 30),
    clicks24h: Math.round(totals.clicks / 30),
    spend30d: totals.cost,
    conversions30d: Math.round(totals.conversions),
    revenue30d: totals.revenue,
  };
}

async function fetchLinkedInStats(token: string): Promise<LiveStats> {
  const headers = { Authorization: `Bearer ${token}`, 'LinkedIn-Version': '202401', 'X-Restli-Protocol-Version': '2.0.0' };
  const me = await jsonFetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });

  const acls = await jsonFetch(
    'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organizationalTarget~))',
    { headers: { Authorization: `Bearer ${token}` } }
  ).catch(() => ({ elements: [] }));

  const org = acls.elements?.[0]?.['organizationalTarget~'] || acls.elements?.[0]?.organizationalTarget;
  const orgUrn = typeof org === 'string' ? org : org?.id ? `urn:li:organization:${org.id}` : acls.elements?.[0]?.organizationalTarget;
  const orgId = String(orgUrn || '').replace('urn:li:organization:', '');
  const orgName = org?.localizedName || org?.vanityName || me.name || 'LinkedIn';

  if (!orgId) {
    return {
      accountName: me.name || me.email || 'LinkedIn member',
      externalId: me.sub,
      followers: 0,
      growthRate: 0,
      healthScore: 40,
      impressions24h: 0,
      reach24h: 0,
      engagement24h: 0,
      clicks24h: 0,
      spend30d: 0,
      conversions30d: 0,
      revenue30d: 0,
      demographics: {
        source: 'linkedin_member',
        note: 'LinkedIn will not give page reach on a personal login. Your LinkedIn app needs Community Management / organization products, and you must be a Page admin.',
      },
    };
  }

  const followers = await jsonFetch(
    `https://api.linkedin.com/v2/networkSizes/urn:li:organization:${orgId}?edgeType=CompanyFollowedByMember`,
    { headers }
  ).catch(() => ({ firstDegreeSize: 0 }));

  const shareStats = await jsonFetch(
    `https://api.linkedin.com/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${orgId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  ).catch(() => ({ elements: [] }));
  const share = shareStats.elements?.[0]?.totalShareStatistics || {};
  const followerStats = await jsonFetch(
    `https://api.linkedin.com/v2/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${orgId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  ).catch(() => ({ elements: [] }));
  const follower = followerStats.elements?.[0] || {};

  return {
    accountName: orgName,
    externalId: orgId,
    followers: Number(followers.firstDegreeSize || follower.followerCounts?.organicFollowerCount || 0),
    growthRate: 0,
    healthScore: Number(share.impressionCount || 0) ? 74 : 55,
    impressions24h: Math.round(Number(share.impressionCount || 0) / 30),
    reach24h: Math.round(Number(share.uniqueImpressionsCount || share.impressionCount || 0) / 30),
    engagement24h: Math.round(Number(share.clickCount || 0) / 30) + Math.round(Number(share.likeCount || 0) / 30),
    clicks24h: Math.round(Number(share.clickCount || 0) / 30),
    spend30d: 0,
    conversions30d: 0,
    revenue30d: 0,
    demographics: {
      source: 'linkedin_organization',
      countries: Object.fromEntries(
        (follower.followerCountsByGeoCountry || []).map((row: any) => [
          row.geo || row.country,
          Number(row.followerCounts?.organicFollowerCount || 0),
        ])
      ),
      ageGender: Object.fromEntries(
        (follower.followerCountsByMemberAge || []).map((row: any) => [
          String(row.memberAge || row.age),
          Number(row.followerCounts?.organicFollowerCount || 0),
        ])
      ),
    },
  };
}

async function fetchTikTokStats(token: string): Promise<LiveStats> {
  const info = await jsonFetch('https://open.tiktokapis.com/v2/user/info/?fields=display_name,follower_count,likes_count,video_count', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const user = info.data?.user || info.user || {};
  const followers = Number(user.follower_count || 0);
  return {
    accountName: user.display_name || 'TikTok',
    externalId: user.open_id,
    followers,
    growthRate: 0,
    healthScore: followers ? 72 : 50,
    impressions24h: 0,
    reach24h: 0,
    engagement24h: Number(user.likes_count || 0),
    clicks24h: 0,
    spend30d: 0,
    conversions30d: 0,
    revenue30d: 0,
  };
}

export async function createMetaBoost(input: {
  accessToken: string;
  adAccountId: string;
  name: string;
  dailyBudget: number;
}) {
  const cents = Math.max(100, Math.round(input.dailyBudget * 100));
  return jsonFetch(`https://graph.facebook.com/v21.0/${input.adAccountId}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      name: input.name,
      objective: 'OUTCOME_TRAFFIC',
      status: 'PAUSED',
      special_ad_categories: '[]',
      daily_budget: String(cents),
      access_token: input.accessToken,
    }),
  });
}
