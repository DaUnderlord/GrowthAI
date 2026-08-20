import React, { useState } from 'react';
import { 
  Zap, 
  Sparkles, 
  Clock, 
  RotateCcw, 
  CheckCircle2, 
  TrendingUp, 
  Target, 
  ArrowRight,
  DollarSign
} from 'lucide-react';
import { ClientProfile } from '../types';
import { MOCK_POSTS } from '../data/mockClients';

interface AutonomousReboostProps {
  client: ClientProfile;
}

export const AutonomousReboostView: React.FC<AutonomousReboostProps> = ({ client }) => {
  const [selectedPost, setSelectedPost] = useState(MOCK_POSTS[0]);
  const [reboostApproved, setReboostApproved] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-white">Autonomous Reboost Agent</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Detects high-performing or decaying posts with evergreen potential, generating automated repost schedules, cross-platform format shifts, and micro-budget ad boosting parameters for <span className="text-indigo-300 font-semibold">{client.name}</span>.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-amber-300">
          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          <span>2 High-Potential Posts Ready</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Candidate Post List */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
          <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
            Evergreen Candidates for Reboost
          </h3>

          <div className="space-y-3">
            {MOCK_POSTS.map((post) => (
              <div
                key={post.id}
                onClick={() => {
                  setSelectedPost(post);
                  setReboostApproved(false);
                }}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedPost.id === post.id
                    ? 'bg-indigo-600/15 border-indigo-500 text-white'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                  <span className="uppercase font-bold text-cyan-400">{post.platform} • {post.postType}</span>
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

        {/* Reboost AI Strategy Panel */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-cyan-400 block">Selected Asset Audit</span>
              <h3 className="text-base font-bold text-white">{selectedPost.title}</h3>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-slate-950 text-emerald-400 border border-slate-800">
              {selectedPost.saves.toLocaleString()} Saves
            </span>
          </div>

          {/* AI Recommended Reboost Tactics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" />
                1. Cross-Platform Format Transformation
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                Repackage this Reel into a 6-slide LinkedIn PDF Carousel & short YouTube Short to capture B2B decision makers.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                2. Optimal Repost Timing Window
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                Schedule dispatch for Thursday at 8:15 PM local time (14 days after initial publication to reset algorithm reach).
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />
                3. Micro-Budget Paid Ad Retargeting
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                Allocate $35/day Meta ad spend targeting users who saved past skincare posts in the last 30 days. Expected ROAS: 6.2x.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" />
                4. Automated DM Keyword Lead Magnet
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                Attach WhatsApp & IG DM auto-responder trigger word <span className="text-cyan-300 font-bold">'DOCTOR'</span> to instantly deliver clinic discount link.
              </p>
            </div>
          </div>

          {/* Action Approval */}
          <div className="pt-2">
            {reboostApproved ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="font-bold">Autonomous Reboost Workflow Scheduled!</p>
                    <p className="text-slate-300 text-[11px]">Dispatch scheduled for Thursday 8:15 PM with $35/day retargeting setup.</p>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setReboostApproved(true)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white font-bold text-xs shadow-xl shadow-amber-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Zap className="w-4 h-4 text-amber-200" />
                <span>Approve Autonomous Reboost Schedule & $35 Ad Allocation</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
