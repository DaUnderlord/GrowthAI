import React, { useEffect, useState } from 'react';
import { CalendarBriefPayload } from '../types';
import { fetchCalendarBrief } from '../lib/supabase';

const CRAFT_LABELS: Record<string, string> = {
  designer: 'Graphic designer',
  video_editor: 'Video editor',
  social_marketer: 'Social marketer',
  copywriter: 'Copywriter',
  strategist: 'Strategist',
  collaborator: 'Collaborator',
};

interface CalendarBriefViewProps {
  token: string;
}

export const CalendarBriefView: React.FC<CalendarBriefViewProps> = ({ token }) => {
  const [payload, setPayload] = useState<CalendarBriefPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchCalendarBrief(token);
        if (!cancelled) setPayload(data);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Could not load brief.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#071018] px-4 text-sm text-slate-400">
        Loading shared calendar brief…
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#071018] px-4 text-center">
        <h1 className="font-display text-2xl text-white">Brief unavailable</h1>
        <p className="max-w-md text-sm text-slate-400">{error || 'This link is invalid or revoked.'}</p>
      </div>
    );
  }

  const items = payload.items || [];

  return (
    <div className="min-h-screen bg-[#071018] px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-3 border-b border-white/10 pb-6">
          <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300/80">GrowthOS · Shared brief</p>
          <div className="flex items-start gap-4">
            {payload.client?.logo ? (
              <img
                src={payload.client.logo}
                alt=""
                className="h-12 w-12 rounded-xl object-cover ring-1 ring-white/10"
              />
            ) : null}
            <div>
              <h1 className="font-display text-3xl font-medium text-white">
                {payload.client?.name || 'Shared calendar'}
              </h1>
              <p className="mt-1 text-sm text-slate-400">{payload.share?.label}</p>
              {payload.client?.primaryGoal && (
                <p className="mt-2 text-sm text-slate-300">Goal: {payload.client.primaryGoal}</p>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Read-only creative brief · {items.length} post{items.length === 1 ? '' : 's'}
            {payload.members?.length
              ? ` · shared with ${payload.members.length} collaborator${payload.members.length === 1 ? '' : 's'}`
              : ''}
          </p>
        </header>

        {payload.members?.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-semibold text-slate-300">Team on this brief</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {payload.members.map((m, idx) => (
                <span
                  key={`${m.email || m.userId || idx}`}
                  className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-[11px] text-slate-300"
                >
                  {CRAFT_LABELS[m.craftRole] || m.craftRole}
                  {m.email ? ` · ${m.email}` : ''}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          {items.length === 0 ? (
            <p className="p-6 text-sm text-slate-400">No posts on this calendar yet.</p>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {items.map((item) => (
                <article key={item.id} className="space-y-2 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-base font-medium text-white">{item.topic}</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.date} {item.time} · {item.platform} · {item.contentType}
                      </p>
                    </div>
                    {(item.assigneeName || item.assigneeCraft) && (
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] text-cyan-100">
                        {item.assigneeName || 'Unassigned'}
                        {item.assigneeCraft
                          ? ` · ${CRAFT_LABELS[item.assigneeCraft] || item.assigneeCraft}`
                          : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-300">&ldquo;{item.hookText}&rdquo;</p>
                  {item.captionText && (
                    <p className="text-xs leading-5 text-slate-500">{item.captionText}</p>
                  )}
                  <p className="text-xs text-slate-400">CTA: {item.cta}</p>
                  {item.designerNotes && (
                    <p className="rounded-xl border border-white/10 bg-slate-950/40 p-3 text-xs text-slate-300">
                      Creative notes: {item.designerNotes}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
