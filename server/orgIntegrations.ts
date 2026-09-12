import { getSupabaseAdmin } from './supabaseAdmin';

export type ProviderFamily = 'meta' | 'google' | 'tiktok' | 'linkedin';

export type FamilyCreds = {
  family: ProviderFamily;
  clientId: string;
  secret: string;
  extra?: Record<string, string>;
  configured: boolean;
  source: 'org' | 'env' | 'none';
  verifyToken?: string;
};

export type OrgMetaCreds = {
  appId: string;
  appSecret: string;
  verifyToken: string;
  configured: boolean;
  source: 'org' | 'env' | 'none';
};

export function familyForPlatform(platform: string): ProviderFamily {
  if (platform === 'tiktok') return 'tiktok';
  if (platform === 'linkedin') return 'linkedin';
  if (platform === 'youtube' || platform === 'google_analytics' || platform === 'google_ads') return 'google';
  return 'meta';
}

async function loadOrgRow(orgId?: string | null) {
  if (!orgId) return null;
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin.from('org_provider_secrets').select('*').eq('org_id', orgId).maybeSingle();
    return data;
  } catch {
    return null;
  }
}

export async function getOrgFamilyCreds(orgId: string | null | undefined, family: ProviderFamily): Promise<FamilyCreds> {
  const row = await loadOrgRow(orgId);

  if (family === 'meta') {
    if (row?.meta_app_id && row?.meta_app_secret) {
      return {
        family,
        clientId: row.meta_app_id,
        secret: row.meta_app_secret,
        configured: true,
        source: 'org',
        verifyToken: row.meta_webhook_verify_token || '',
      };
    }
    const appId = process.env.META_CLIENT_ID || process.env.META_APP_ID || '';
    const appSecret = process.env.META_APP_SECRET || '';
    if (appId && appSecret) {
      return {
        family,
        clientId: appId,
        secret: appSecret,
        configured: true,
        source: 'env',
        verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || '',
      };
    }
    return { family, clientId: '', secret: '', configured: false, source: 'none', verifyToken: '' };
  }

  if (family === 'google') {
    if (row?.google_client_id && row?.google_client_secret) {
      return {
        family,
        clientId: row.google_client_id,
        secret: row.google_client_secret,
        extra: {
          developerToken: row.google_ads_developer_token || '',
          customerId: row.google_ads_customer_id || '',
        },
        configured: true,
        source: 'org',
      };
    }
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const secret = process.env.GOOGLE_CLIENT_SECRET || '';
    if (clientId && secret) {
      return {
        family,
        clientId,
        secret,
        extra: {
          developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
          customerId: process.env.GOOGLE_ADS_CUSTOMER_ID || '',
        },
        configured: true,
        source: 'env',
      };
    }
    return { family, clientId: '', secret: '', configured: false, source: 'none' };
  }

  if (family === 'tiktok') {
    if (row?.tiktok_client_key && row?.tiktok_client_secret) {
      return { family, clientId: row.tiktok_client_key, secret: row.tiktok_client_secret, configured: true, source: 'org' };
    }
    const clientId = process.env.TIKTOK_CLIENT_KEY || '';
    const secret = process.env.TIKTOK_CLIENT_SECRET || '';
    if (clientId && secret) {
      return { family, clientId, secret, configured: true, source: 'env' };
    }
    return { family, clientId: '', secret: '', configured: false, source: 'none' };
  }

  if (row?.linkedin_client_id && row?.linkedin_client_secret) {
    return { family, clientId: row.linkedin_client_id, secret: row.linkedin_client_secret, configured: true, source: 'org' };
  }
  const clientId = process.env.LINKEDIN_CLIENT_ID || '';
  const secret = process.env.LINKEDIN_CLIENT_SECRET || '';
  if (clientId && secret) {
    return { family, clientId, secret, configured: true, source: 'env' };
  }
  return { family, clientId: '', secret: '', configured: false, source: 'none' };
}

export async function getAllOrgProviderStatus(orgId?: string | null) {
  const families: ProviderFamily[] = ['meta', 'google', 'tiktok', 'linkedin'];
  const entries = await Promise.all(families.map((family) => getOrgFamilyCreds(orgId, family)));
  return Object.fromEntries(
    entries.map((creds) => [
      creds.family,
      {
        configured: creds.configured,
        source: creds.source,
        clientId: creds.clientId ? `${creds.clientId.slice(0, 4)}…` : '',
        verifyToken: creds.verifyToken || '',
      },
    ])
  );
}

export async function getOrgMetaCreds(orgId?: string | null): Promise<OrgMetaCreds> {
  const creds = await getOrgFamilyCreds(orgId, 'meta');
  return {
    appId: creds.clientId,
    appSecret: creds.secret,
    verifyToken: creds.verifyToken || '',
    configured: creds.configured,
    source: creds.source,
  };
}

export async function saveOrgMetaCreds(
  orgId: string,
  input: { appId: string; appSecret?: string; verifyToken?: string }
) {
  return saveOrgFamilyCreds(orgId, 'meta', {
    clientId: input.appId,
    clientSecret: input.appSecret,
    verifyToken: input.verifyToken,
  });
}

export async function saveOrgFamilyCreds(
  orgId: string,
  family: ProviderFamily,
  input: {
    clientId?: string;
    clientSecret?: string;
    verifyToken?: string;
    developerToken?: string;
    customerId?: string;
  }
) {
  const admin = getSupabaseAdmin();
  const { data: existing } = await admin.from('org_provider_secrets').select('*').eq('org_id', orgId).maybeSingle();

  const row: Record<string, unknown> = {
    org_id: orgId,
    updated_at: new Date().toISOString(),
  };

  if (family === 'meta') {
    row.meta_app_id = (input.clientId || existing?.meta_app_id || '').trim();
    row.meta_app_secret = input.clientSecret?.trim() || existing?.meta_app_secret || null;
    row.meta_webhook_verify_token =
      input.verifyToken?.trim() || existing?.meta_webhook_verify_token || `gos_${orgId.slice(0, 8)}`;
    if (!row.meta_app_id) throw new Error('Meta App ID is required.');
  } else if (family === 'google') {
    row.google_client_id = (input.clientId || existing?.google_client_id || '').trim();
    row.google_client_secret = input.clientSecret?.trim() || existing?.google_client_secret || null;
    if (input.developerToken !== undefined) row.google_ads_developer_token = input.developerToken.trim() || null;
    if (input.customerId !== undefined) row.google_ads_customer_id = input.customerId.replace(/-/g, '').trim() || null;
    if (!row.google_client_id) throw new Error('Google Client ID is required.');
  } else if (family === 'tiktok') {
    row.tiktok_client_key = (input.clientId || existing?.tiktok_client_key || '').trim();
    row.tiktok_client_secret = input.clientSecret?.trim() || existing?.tiktok_client_secret || null;
    if (!row.tiktok_client_key) throw new Error('TikTok Client Key is required.');
  } else {
    row.linkedin_client_id = (input.clientId || existing?.linkedin_client_id || '').trim();
    row.linkedin_client_secret = input.clientSecret?.trim() || existing?.linkedin_client_secret || null;
    if (!row.linkedin_client_id) throw new Error('LinkedIn Client ID is required.');
  }

  const { error } = await admin.from('org_provider_secrets').upsert(row);
  if (error) throw new Error(error.message);

  const saved = await getOrgFamilyCreds(orgId, family);
  return {
    family,
    configured: saved.configured,
    verifyToken: saved.verifyToken,
    clientId: saved.clientId ? `${saved.clientId.slice(0, 4)}…` : '',
  };
}

export async function listOrgWebhookTokens() {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin.from('org_provider_secrets').select('meta_webhook_verify_token, meta_app_secret');
    return data || [];
  } catch {
    return [];
  }
}
