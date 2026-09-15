import React, { useState } from 'react';
import { 
  Target, 
  Sparkles, 
  TrendingUp, 
  Clock, 
  Lightbulb, 
  CheckCircle2, 
  AlertCircle,
  BarChart2,
  RefreshCw
} from 'lucide-react';
import { ClientProfile, PredictionResult } from '../types';
import { callGrowthAi, withBrandContext } from '../lib/aiApi';

interface PredictionEngineProps {
  client: ClientProfile;
}

export const PredictionEngineView: React.FC<PredictionEngineProps> = ({ client }) => {
  const [platform, setPlatform] = useState('instagram');
  const [contentType, setContentType] = useState('Reel');
  const [hookText, setHookText] = useState(`3 growth plays for ${client.name}`);
  const [targetAudience, setTargetAudience] = useState(client.industryLabel || 'Core buyers');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);

  const handleRunPrediction = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await callGrowthAi<{ prediction: any }>('/api/growth/predict', withBrandContext(client, {
          platform,
          contentType,
          hookText,
          targetAudience,
          industry: client.industry,
      }));
      if (!result.ok) {
        setError(result.error);
      } else if (result.data.prediction) {
        setPrediction(result.data.prediction);
      }
    } catch (err: any) {
      setError(err.message || 'Prediction failed');
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
            <Target className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-bold text-white">AI Virality & Performance Prediction Engine</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Estimate reach from this brand's last-sync followers, 24h reach, and recent provider posts. Posting hour is unknown — we do not store hour-of-day Insights.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-500/20 text-indigo-300">
          <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span>Gemini Predictive Engine</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Simulator Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
            1. Configure Post Idea & Hook
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Social Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="instagram">Instagram Professional</option>
              <option value="tiktok">TikTok</option>
              <option value="linkedin">LinkedIn Professional</option>
              <option value="facebook">Facebook Page</option>
              <option value="youtube">YouTube Shorts</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Content Format</label>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="Reel">Short Reel / Short Video (15s - 30s)</option>
              <option value="Carousel">Infographic Carousel (5 - 8 slides)</option>
              <option value="Story">Interactive Story with Poll</option>
              <option value="Article">Thought Leadership Article</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Hook / Opening Line</label>
            <textarea
              rows={3}
              value={hookText}
              onChange={(e) => setHookText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              placeholder="e.g. Stop making this $200 skincare mistake tonight..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Target Audience Persona</label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            onClick={handleRunPrediction}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-200" />
                <span>Predicting Performance...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-cyan-300" />
                <span>Simulate Virality Score</span>
              </>
            )}
          </button>
        </div>

        {/* Prediction Results Panel */}
        <div className="lg:col-span-2 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
              {error}
            </div>
          )}
          {prediction ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              {prediction.baseline && (
                <p className="text-[11px] text-slate-400">
                  Last sync: {prediction.baseline.followers.toLocaleString()} followers ·{' '}
                  {prediction.baseline.reach24h.toLocaleString()} 24h reach ·{' '}
                  {prediction.baseline.realPostCount} provider posts
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Virality Probability</span>
                  <span className="text-3xl font-extrabold text-cyan-400">{prediction.viralityScore}%</span>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    {prediction.liveDataUsed
                      ? prediction.viralityScore >= 60
                        ? 'High vs last-sync baseline'
                        : 'Grounded in last sync'
                      : 'Unknown without live sync'}
                  </span>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Estimated Reach</span>
                  <span className="text-xl font-extrabold text-white">{prediction.estimatedReach}</span>
                  <span className="text-[10px] text-slate-400 block mt-1">Vs last-sync 24h reach</span>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Engagement Index</span>
                  <span className="text-2xl font-extrabold text-indigo-400">{prediction.engagementScore}/100</span>
                  <span className="text-[10px] text-slate-400 block mt-1">Saves & Shares</span>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Conversion CVR</span>
                  <span className="text-2xl font-extrabold text-emerald-400">{prediction.conversionProbability}</span>
                  <span className="text-[10px] text-slate-400 block mt-1">Lead Likelihood</span>
                </div>
              </div>

              {/* Best Posting Time & Confidence Index */}
              <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-cyan-400">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-medium">Posting hour (not in last sync):</span>
                    <h4 className="text-sm font-bold text-white">{prediction.optimalPostingTime}</h4>
                  </div>
                </div>
                <div className="text-xs bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300">
                  Model Confidence Index: <span className="text-emerald-400 font-bold">{prediction.confidenceScore}%</span>
                </div>
              </div>

              {/* Reasoning & Explanation */}
              <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-indigo-400" />
                  Algorithmic Reasoning & Explanation
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {prediction.reasoning}
                </p>
              </div>

              {/* Recommended Tweaks */}
              <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  AI Recommended Tweaks Before Publishing
                </h4>
                <div className="space-y-2 text-xs">
                  {(prediction.recommendedTweaks || []).map((tweak, i) => (
                    <div key={i} className="flex items-start gap-2 text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{tweak}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              <Target className="w-10 h-10 text-slate-600 mx-auto mb-3 animate-pulse" />
              <p className="text-sm font-semibold text-slate-300">Configure your hook and click simulate.</p>
              {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
