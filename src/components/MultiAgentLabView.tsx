import React, { useState } from 'react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  RefreshCw, 
  Users, 
  CheckCircle2, 
  Zap, 
  Play,
  Layers,
  Award
} from 'lucide-react';
import { ClientProfile } from '../types';
import { GROWTH_AGENT_ROSTER } from '../lib/clientInsights';
import { callGrowthAi, withBrandContext } from '../lib/aiApi';
import { LiveAccountNote } from './LiveAccountNote';

interface MultiAgentLabProps {
  client: ClientProfile;
}

export const MultiAgentLabView: React.FC<MultiAgentLabProps> = ({ client }) => {
  const [prompt, setPrompt] = useState(`Run a 90-day growth council audit for ${client.name} (${client.industryLabel}) to achieve 3x follower engagement and $50k/mo new consultation revenue.`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentOutput, setAgentOutput] = useState<string | null>(null);

  const handleRunCouncil = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await callGrowthAi<{ analysis: string }>('/api/growth/multi-agent', withBrandContext(client, {
          clientName: client.name,
          industry: client.industry,
          targetGoal: client.primaryGoal,
          inputPrompt: prompt,
      }));
      if (!result.ok) {
        setError(result.error);
      } else if (result.data.analysis) {
        setAgentOutput(result.data.analysis);
      }
    } catch (err: any) {
      setError(err.message || 'Multi-agent run failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
            <h2 className="text-xl font-bold text-white">Autonomous Multi-Agent Growth Lab</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            One Gemini run that role-plays seven specialists. They only see last-sync followers, posts, audience, and listed data gaps for {client.name}. 90-day ROI is a projection, not ads data.
          </p>
          <LiveAccountNote client={client} />
        </div>
        <div className="flex items-center gap-2 text-xs bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300">
          <Users className="w-4 h-4 text-indigo-400" />
          <span>7 Active AI Agents</span>
        </div>
      </div>

      {/* Agents Roster Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {GROWTH_AGENT_ROSTER.map((agent) => (
          <div
            key={agent.id}
            className="bg-slate-900 border border-slate-800 p-3 rounded-xl hover:border-indigo-500/40 transition-all text-center space-y-1"
          >
            <div className="text-2xl mb-1">{agent.avatar}</div>
            <h4 className="text-xs font-bold text-white truncate">{agent.name}</h4>
            <p className="text-[10px] text-indigo-300 font-medium truncate">{agent.role}</p>
            <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
              ready
            </span>
          </div>
        ))}
      </div>

      {/* Interactive Council Runner & Chat Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Prompt Input Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
            <Play className="w-4 h-4 text-cyan-400" />
            Launch Strategic Council Prompt
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Growth Goal / Audit Directive</label>
            <textarea
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-sans"
            />
          </div>

          <button
            onClick={handleRunCouncil}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-200" />
                <span>Agents Reasoning in Parallel...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-cyan-200" />
                <span>Execute 7-Agent Council</span>
              </>
            )}
          </button>
        </div>

        {/* Council Output Response */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Bot className="w-4 h-4 text-indigo-400" />
              Collaborative Agent Output Stream
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
              Server-side Gemini
            </span>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
              {error}
            </div>
          )}
          {agentOutput ? (
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl text-xs text-slate-200 space-y-3 font-sans leading-relaxed whitespace-pre-line">
              {agentOutput}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 text-xs">
              Click execute to trigger the collaborative agent council.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
