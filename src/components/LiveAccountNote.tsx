import React from 'react';
import { ClientProfile } from '../types';
import { liveChannelIds, useLiveInsights } from '../lib/liveApi';
import { LiveContextSummary } from '../lib/aiApi';

export function LiveAccountNote({
  client,
  liveContext,
}: {
  client: ClientProfile;
  liveContext?: LiveContextSummary | null;
}) {
  const { insights, loading } = useLiveInsights(client.id);
  const demo = (insights?.demographics || {}) as { followers?: number; reach?: number; spend?: number };
  const realPosts = (insights?.posts || []).filter(
    (p) => p.source === 'provider_media' || (p.id && !/last 24h/i.test(String(p.title || '')))
  );
  const hasLive = liveContext
    ? liveContext.hasLive
    : Number(demo.followers || 0) > 0 ||
      Number(demo.reach || 0) > 0 ||
      Number(demo.spend || 0) > 0 ||
      realPosts.length > 0;
  const updated = liveContext?.updatedAt || insights?.updated_at || null;
  const platforms =
    liveContext?.platforms?.length
      ? liveContext.platforms
      : (client.platforms || []).filter((p) => p.connected).map((p) => p.name || p.id);
  const channelLabels = platforms.length ? platforms : liveChannelIds(insights);
  const postCount = liveContext?.realPostCount ?? realPosts.length;

  if (loading && !insights && !liveContext) {
    return <p className="mt-2 text-[11px] text-slate-500">Checking connected accounts…</p>;
  }

  if (hasLive) {
    return (
      <p className="mt-2 text-[11px] text-emerald-300/90">
        Using last provider sync{channelLabels.length ? ` (${channelLabels.join(', ')})` : ''}
        {postCount ? ` · ${postCount} recent posts` : ''}
        {updated ? ` · ${new Date(updated).toLocaleString()}` : ''}. Hour-of-day and any metric not in that snapshot stay unknown.
      </p>
    );
  }

  return (
    <p className="mt-2 text-[11px] text-amber-200/90">
      No usable last-sync metrics for {client.name}. Connect the brand on Social accounts and tap Sync — AI will not invent follower, reach, spend, or posting-hour figures.
    </p>
  );
}
