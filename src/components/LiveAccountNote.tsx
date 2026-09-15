import React from 'react';
import { ClientProfile } from '../types';
import { useLiveInsights } from '../lib/liveApi';
import { LiveContextSummary } from '../lib/aiApi';

export function LiveAccountNote({
  client,
  liveContext,
}: {
  client: ClientProfile;
  liveContext?: LiveContextSummary | null;
}) {
  const { insights, loading } = useLiveInsights(client.id);
  const connected = (client.platforms || []).filter((p) => p.connected);
  const hasLive = liveContext
    ? liveContext.hasLive
    : insights?.source === 'live_sync' ||
      connected.some(
        (p) => p.connected && (Number(p.followers || 0) > 0 || Boolean(p.lastSync && p.lastSync !== 'Never'))
      );
  const updated = liveContext?.updatedAt || insights?.updated_at || null;
  const platforms =
    liveContext?.platforms?.length
      ? liveContext.platforms
      : connected.map((p) => p.name || p.id);

  if (loading && !insights && !liveContext) {
    return <p className="mt-2 text-[11px] text-slate-500">Checking connected accounts…</p>;
  }

  if (hasLive) {
    return (
      <p className="mt-2 text-[11px] text-emerald-300/90">
        Using last provider sync{platforms.length ? ` (${platforms.join(', ')})` : ''}
        {updated ? ` · ${new Date(updated).toLocaleString()}` : ''}. Metrics not in that snapshot stay unknown.
      </p>
    );
  }

  return (
    <p className="mt-2 text-[11px] text-amber-200/90">
      No live sync for {client.name} yet. Connect this brand on Social accounts and tap Sync — AI will not invent follower, reach, or spend figures.
    </p>
  );
}
