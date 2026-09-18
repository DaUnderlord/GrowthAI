import React, { useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { ClientProfile } from '../types';
import { callGrowthAi, withBrandContext } from '../lib/aiApi';
import { connectedPlatformIds, useLiveInsights } from '../lib/liveApi';
import { LiveAccountNote } from './LiveAccountNote';
import { MetricLabel } from './MetricTip';

export function CreativeLabView({ client }: { client: ClientProfile }) {
  const [topic, setTopic] = useState('');
  const [hook, setHook] = useState('');
  const [fileData, setFileData] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const { insights } = useLiveInsights(client.id);

  const onFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFileData(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await callGrowthAi<{ analysis: any }>('/api/growth/analyze-creative-multimodal', withBrandContext(client, {
        visualAssetUrl: fileData,
        visualAssetType: 'image',
        calendarTopic: topic,
        hookText: hook,
        campaignGoal: client.primaryGoal,
        platform: connectedPlatformIds(client, insights)[0] || 'instagram',
      }));
      if (!result.ok) setError(result.error);
      else setAnalysis(result.data.analysis);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="surface-panel space-y-3 p-5">
        <div className="flex items-center gap-2">
          <ImagePlus className="h-4 w-4 text-cyan-300" />
          <h3 className="text-sm font-semibold text-white">Multimodal creative analysis</h3>
        </div>
        <p className="text-xs text-slate-400">
          Upload a still or thumbnail. Gemini reads the image against {client.name}&apos;s last-sync posts when they exist. Predicted success is 0 without a live sync.
        </p>
        <LiveAccountNote client={client} />
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Calendar topic"
          className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
        />
        <input
          value={hook}
          onChange={(e) => setHook(e.target.value)}
          placeholder="Hook text"
          className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
        />
        <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} className="text-xs text-slate-400" />
        <button type="button" onClick={() => void run()} disabled={busy} className="primary-button">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Analyze creative'}
        </button>
        {error && <p className="text-xs text-rose-300">{error}</p>}
      </div>
      {analysis && (
        <div className="surface-panel space-y-2 p-5 text-sm text-slate-300">
          <p>
            <MetricLabel metric="creativeVisual">Visual score</MetricLabel>: {analysis.visualScore}
          </p>
          <p>
            <MetricLabel metric="creativeGoalMatch">Goal match</MetricLabel>: {analysis.campaignGoalMatchPct}%
          </p>
          <p>
            <MetricLabel metric="creativeSuccess">Predicted success</MetricLabel>: {analysis.predictedSuccessRate}%
          </p>
          <p className="whitespace-pre-line">{analysis.visualHookAudit}</p>
        </div>
      )}
    </div>
  );
}
