import React, { useState } from 'react';
import { 
  FileText, 
  Sparkles, 
  Copy, 
  Check, 
  RefreshCw, 
  Hash, 
  MessageSquare, 
  Target,
  Zap
} from 'lucide-react';
import { ClientProfile } from '../types';
import { callGrowthAi, withBrandContext } from '../lib/aiApi';
import { LiveAccountNote } from './LiveAccountNote';

interface ContentOptimizerProps {
  client: ClientProfile;
}

export const ContentOptimizerView: React.FC<ContentOptimizerProps> = ({ client }) => {
  const [topic, setTopic] = useState(`Growth ideas for ${client.name}`);
  const [channel, setChannel] = useState('Instagram Reel');
  const [goal, setGoal] = useState(client.primaryGoal || 'Maximize Saves, Shares & Leads');
  const [audience, setAudience] = useState(client.industryLabel || 'Core buyers');

  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await callGrowthAi<{ optimization: string }>('/api/growth/optimize-content', withBrandContext(client, {
        topic,
        channel,
        goal,
        audience,
      }));
      if (!result.ok) {
        setError(result.error);
      } else if (result.data.optimization) {
        setOutput(result.data.optimization);
      }
    } catch (err: any) {
      setError(err.message || 'Optimization failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (output) {
      navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-bold text-white">AI Content Optimization Agent</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Drafts hooks and captions that should cite a last-sync post or metric for {client.name}. If there are no recent posts, it will say so instead of inventing winners.
          </p>
          <LiveAccountNote client={client} />
        </div>
        <div className="flex items-center gap-2 text-xs bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300">
          <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span>Gemini Copy Optimizer</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
            Configure Content Brief
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Core Topic / Angle</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Target Channel</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="Instagram Reel">Instagram Reel</option>
              <option value="TikTok Video">TikTok Video</option>
              <option value="LinkedIn Post">LinkedIn Thought Leadership</option>
              <option value="Facebook Carousel">Facebook Carousel</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Primary Campaign Goal</label>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Audience Target</label>
            <input
              type="text"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-200" />
            ) : (
              <Sparkles className="w-4 h-4 text-cyan-200" />
            )}
            <span>Generate Optimized Assets</span>
          </button>
        </div>

        {/* Output Area */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              Generated Viral Asset Suite
            </h3>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copied ? 'Copied!' : 'Copy Assets'}</span>
            </button>
          </div>

          {error && (
            <div className="mb-3 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
              {error}
            </div>
          )}
          {output ? (
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl text-xs text-slate-200 space-y-4 font-mono leading-relaxed whitespace-pre-wrap">
              {output}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 text-xs">
              Click generate to create optimized hooks and captions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
