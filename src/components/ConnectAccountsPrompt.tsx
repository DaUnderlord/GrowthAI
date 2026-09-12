import React, { useEffect, useState } from 'react';
import { ClientProfile } from '../types';
import { authFetch } from '../lib/authFetch';
import { navigateView } from '../lib/liveApi';
import { useWorkspaceLocale } from '../lib/WorkspaceLocale';

type Family = 'meta' | 'google' | 'tiktok' | 'linkedin';

export function ConnectAccountsPrompt({
  client,
  needed = ['meta', 'google', 'tiktok', 'linkedin'],
}: {
  client?: ClientProfile | null;
  needed?: Family[];
}) {
  const { t } = useWorkspaceLocale();
  const [missing, setMissing] = useState<Family[]>([]);

  useEffect(() => {
    void authFetch('/api/org/providers')
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          setMissing(needed);
          return;
        }
        setMissing(needed.filter((family) => !data.families?.[family]?.configured));
      })
      .catch(() => setMissing(needed));
  }, [needed.join(',')]);

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
