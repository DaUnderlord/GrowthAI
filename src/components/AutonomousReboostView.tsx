import React, { useEffect, useMemo, useState } from 'react';
import {
  Zap,
  Sparkles,
  Clock,
  RotateCcw,
  CheckCircle2,
  TrendingUp,
  Target,
  ArrowRight,
  DollarSign,
} from 'lucide-react';
import { ClientProfile, ContentCalendarItem } from '../types';
import { buildPostSignals } from '../lib/clientInsights';
import { subscribeToCalendarItems } from '../lib/supabase';

interface AutonomousReboostProps {
  client: ClientProfile;
}

export const AutonomousReboostView: React.FC<AutonomousReboostProps> = ({ client }) => {
  const [calendarItems, setCalendarItems] = useState<ContentCalendarItem[]>([]);
  const posts = useMemo(() => buildPostSignals(client, calendarItems), [client, calendarItems]);
  const candidates = useMemo(
    () => posts.filter((p) => p.reboostRecommended || p.status === 'viral' || p.status === 'decaying'),
    [posts]
  );
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const selectedPost = candidates.find((p) => p.id === selectedPostId) || candidates[0] || null;
  const [reboostApproved, setReboostApproved] = useState(false);

  useEffect(() => {
    return subscribeToCalendarItems(client.id, setCalendarItems);
  }, [client.id]);

  useEffect(() => {
    if (candidates[0] && !selectedPostId) {
      setSelectedPostId(candidates[0].id);
    }
  }, [candidates, selectedPostId]);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-white">Autonomous Reboost Agent</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Detects high-performing or decaying posts with evergreen potential for{' '}
            <span className="text-indigo-300 font-semibold">{client.name}</span>.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-amber-300">
          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          <span>{candidates.length} candidate{candidates.length === 1 ? '' : 's'} ready</span>
        </div>
      </div>

      {candidates.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-400">
          No reboost candidates yet. Schedule calendar content or connect social accounts to generate signals.
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
          <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
            Evergreen Candidates for Reboost
          </h3>

          <div className="space-y-3">
            {candidates.map((post) => (
              <div
                key={post.id}
                onClick={() => {
                  setSelectedPostId(post.id);
                  setReboostApproved(false);
                }}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedPost?.id === post.id
                    ? 'bg-indigo-600/15 border-indigo-500 text-white'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                  <span className="uppercase font-bold text-cyan-400">
                    {post.platform} • {post.postType}
                  </span>
                  <span className="font-semibold text-emerald-400">{post.viralityScore}% Virality</span>
                </div>
                <h4 className="text-xs font-bold leading-snug line-clamp-2">{post.title}</h4>
                <div className="flex items-center justify-between text-[11px] mt-2 text-slate-400">
                  <span>{post.saves.toLocaleString()} Saves</span>
                  <span className="text-indigo-300 font-semibold">
                    {post.reboostRecommended ? 'Reboost Recommended' : 'Active Momentum'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedPost && (
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">Selected post</p>
              <h3 className="text-lg font-bold text-white mt-1">{selectedPost.title}</h3>
              <p className="text-xs text-slate-400 mt-1">{selectedPost.hookText}</p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <p>Reach {selectedPost.reach.toLocaleString()}</p>
              <p className="text-emerald-400">{selectedPost.viralityScore}% virality</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <Clock className="w-4 h-4 text-cyan-400 mb-2" />
              <p className="text-[10px] text-slate-500">Repost window</p>
              <p className="text-sm font-semibold text-white">Next 48 hours</p>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <DollarSign className="w-4 h-4 text-emerald-400 mb-2" />
              <p className="text-[10px] text-slate-500">Suggested boost</p>
              <p className="text-sm font-semibold text-white">
                {formatCurrency(Math.max(25, Math.round(client.monthlyBudget * 0.02)))}
              </p>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <Target className="w-4 h-4 text-indigo-400 mb-2" />
              <p className="text-[10px] text-slate-500">Audience</p>
              <p className="text-sm font-semibold text-white">Engagers + savers</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-300 space-y-2">
            <p className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-cyan-400" /> Cross-post as {selectedPost.postType === 'Reel' ? 'carousel recap' : 'short-form clip'} on secondary channels.</p>
            <p className="flex items-center gap-2"><RotateCcw className="w-4 h-4 text-amber-400" /> Refresh hook with urgency CTA aligned to {client.primaryGoal}.</p>
            <p className="flex items-center gap-2"><ArrowRight className="w-4 h-4 text-indigo-400" /> Retarget warm audiences who saved or shared within 7 days.</p>
          </div>

          <button
            type="button"
            onClick={() => setReboostApproved(true)}
            disabled={reboostApproved}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold py-3 rounded-xl transition"
          >
            {reboostApproved ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Reboost plan saved for ops review
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Approve autonomous reboost plan
              </>
            )}
          </button>
        </div>
        )}
      </div>
      )}
    </div>
  );
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}
