import React, { useEffect, useState } from 'react';
import { ClientProfile } from '../types';
import { authFetch } from '../lib/authFetch';
import { navigateView } from '../lib/liveApi';
import { useWorkspaceLocale } from '../lib/WorkspaceLocale';

type Family = 'meta' | 'google' | 'tiktok' | 'linkedin';

const FAMILY_PLATFORMS: Record<Family, string[]> = {
  meta: ['instagram', 'facebook', 'meta_ads', 'whatsapp'],
  google: ['google_analytics', 'google_ads', 'youtube'],
  tiktok: ['tiktok'],
  linkedin: ['linkedin'],
};

export function ConnectAccountsPrompt({
  client,
  needed = ['meta'],
}: {
  client?: ClientProfile | null;
  needed?: Family[];
}) {
  const { t } = useWorkspaceLocale();
  const [missing, setMissing] = useState<Family[]>([]);
  const neededKey = needed.join(',');

  useEffect(() => {
    let cancelled = false;
    const families = neededKey.split(',').filter(Boolean) as Family[];
    void (async () => {
      try {
        const orgRes = await authFetch('/api/org/providers');
        const org = await orgRes.json();
        let brandPlatforms: string[] = [];
        if (client?.id) {
          const connRes = await authFetch(
            `/api/socials/connections?clientId=${encodeURIComponent(client.id)}`
          );
          const conn = await connRes.json();
          brandPlatforms = (conn?.connections || []).map((row: { platform?: string }) =>
            String(row.platform || '').toLowerCase()
          );
        }
        if (cancelled) return;
        setMissing(
          families.filter((family) => {
            const brandHas = FAMILY_PLATFORMS[family].some((platform) => brandPlatforms.includes(platform));
            if (brandHas) return false;
            return !org?.success || !org?.families?.[family]?.configured;
          })
        );
      } catch {
        if (!cancelled) setMissing(families);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [neededKey, client?.id]);

  if (!missing.length) return null;

  return (
    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
      <p className="font-medium">{t('connectYourOwnApps')}</p>
      <p className="mt-1 text-xs text-amber-100/80">
        {t('connectPromptBody')} {missing.map((f) => t(`family_${f}`)).join(', ')}.
        {!client?.id ? ` ${t('selectBrandFirst')}` : ''}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="secondary-button" onClick={() => navigateView('agency', { tab: 'apps' })}>
          {t('openAgencyHub')}
        </button>
        <button type="button" className="secondary-button" onClick={() => navigateView('settings')}>
          {t('openIntegrations')}
        </button>
      </div>
    </div>
  );
}
