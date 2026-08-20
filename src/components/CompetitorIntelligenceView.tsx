import React, { useState } from 'react';
import { 
  Layers, 
  Sparkles, 
  TrendingUp, 
  AlertTriangle, 
  Eye, 
  Target, 
  Search,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { ClientProfile } from '../types';
import { MOCK_COMPETITORS } from '../data/mockClients';
import { callGrowthAi } from '../lib/aiApi';

interface CompetitorIntelligenceProps {
  client: ClientProfile;
}

export const CompetitorIntelligenceView: React.FC<CompetitorIntelligenceProps> = ({ client }) => {
  const [competitorInput, setCompetitorInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanReport, setScanReport] = useState<string | null>(null);

  const handleScanCompetitor = async () => {
    if (!competitorInput.trim()) {
      setError('Enter a competitor name or handle first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await callGrowthAi<{ report: string }>('/api/growth/competitor-scan', {
        competitorName: competitorInput.trim(),
        industry: client.industry,
        channel: 'instagram',
      });
      if (!result.ok) {
        setError(result.error);
      } else if (result.data.report) {
        setScanReport(result.data.report);
      }
    } catch (err: any) {
      setError(err?.message || 'Scan failed');
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
            <Layers className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-bold text-white">Competitor Intelligence Radar</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Real-time competitor benchmarking, share of voice tracking, content gap discovery, and counter-strategy generation for <span className="text-indigo-300 font-semibold">{client.name}</span>.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>3 Competitors Monitored</span>
        </div>
      </div>

      {/* Live AI Competitor Scanner Input */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Search className="w-4 h-4 text-cyan-400" />
          Run AI Competitor Whitespace Scan
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={competitorInput}
            onChange={(e) => setCompetitorInput(e.target.value)}
            placeholder="Enter competitor handle or brand name..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleScanCompetitor}
            disabled={loading}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-200" />
            ) : (
              <Sparkles className="w-4 h-4 text-cyan-200" />
            )}
            <span>Scan Competitor Gaps</span>
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            {error}
          </div>
        )}
        {scanReport && (
          <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 space-y-2">
            <h4 className="font-bold text-white text-sm text-cyan-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              AI Competitor Analysis & Counter-Strategy
            </h4>
            <div className="prose prose-invert max-w-none text-xs leading-relaxed whitespace-pre-line">
              {scanReport}
            </div>
          </div>
        )}
      </div>

      {/* Competitors Benchmark Table & Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {MOCK_COMPETITORS.map((comp) => (
          <div
            key={comp.id}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">{comp.name}</h3>
                <span className="text-[10px] text-slate-400">Industry Direct Competitor</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                comp.threatLevel === 'High' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-300'
              }`}>
                {comp.threatLevel} Threat
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Followers:</span>
                <span className="font-bold text-white">{comp.followers.toLocaleString()}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[10px] block">Engagement Rate:</span>
                <span className="font-bold text-emerald-400">{comp.engagementRatePct}%</span>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 text-xs">
              <span className="text-slate-400 text-[10px] block">Dominant Format:</span>
              <span className="font-semibold text-cyan-300">{comp.dominantFormat}</span>
            </div>

            <div className="space-y-1.5 text-xs">
              <span className="font-semibold text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Discovered Content Gaps & Whitespace:
              </span>
              <ul className="space-y-1 text-slate-300 pl-1">
                {comp.contentGaps.map((gap, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-cyan-400 font-bold">•</span>
                    <span>{gap}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
