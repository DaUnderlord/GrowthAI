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
import { callGrowthAi, withBrandContext } from '../lib/aiApi';
import { LiveAccountNote } from './LiveAccountNote';

interface CompetitorIntelligenceProps {
  client: ClientProfile;
}

export const CompetitorIntelligenceView: React.FC<CompetitorIntelligenceProps> = ({ client }) => {
  const [competitorInput, setCompetitorInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanReport, setScanReport] = useState<string | null>(null);
  const [scannedNames, setScannedNames] = useState<string[]>([]);

  const handleScanCompetitor = async () => {
    if (!competitorInput.trim()) {
      setError('Enter a competitor name or handle first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await callGrowthAi<{ report: string }>('/api/growth/competitor-scan', withBrandContext(client, {
        competitorName: competitorInput.trim(),
        industry: client.industry,
        channel: 'instagram',
        website: competitorInput.trim(),
      }));
      if (!result.ok) {
        setError(result.error);
      } else if (result.data.report) {
        setScanReport(result.data.report);
        setScannedNames((prev) =>
          prev.includes(competitorInput.trim()) ? prev : [...prev, competitorInput.trim()]
        );
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
            Public web search for the competitor. {client.name}&apos;s numbers come only from last Sync — competitor follower counts are only as good as public sources.
          </p>
          <LiveAccountNote client={client} />
        </div>
        <div className="flex items-center gap-2 text-xs bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>{scannedNames.length} competitor{scannedNames.length === 1 ? '' : 's'} scanned</span>
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

      {scannedNames.length > 0 ? (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {scannedNames.map((name) => (
          <div
            key={name}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-xl space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">{name}</h3>
                <span className="text-[10px] text-slate-400">Scanned for {client.name}</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Tracked
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Run another scan above to refresh AI counter-strategies for this competitor.
            </p>
          </div>
        ))}
      </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-400">
          No competitors scanned yet. Enter a competitor handle above to generate an AI whitespace report.
        </div>
      )}
    </div>
  );
};
