import React, { useState } from 'react';
import { BLUEPRINT_TOPICS } from '../data/blueprintData';
import { FileText, Layers, CheckCircle2, ChevronRight, Zap } from 'lucide-react';

export const BlueprintExplorerView: React.FC = () => {
  const [selectedTopicId, setSelectedTopicId] = useState(BLUEPRINT_TOPICS[0].id);

  const selectedTopic = BLUEPRINT_TOPICS.find((t) => t.id === selectedTopicId) || BLUEPRINT_TOPICS[0];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-bold text-white">GrowthOS AI Startup Blueprint & PRD Specs</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Complete technical blueprint, system architecture, multi-tenant database schemas, API contracts, multi-agent workflows, prompt engineering framework, and enterprise GDPR/SOC2 security compliance specifications.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-500/20 text-indigo-300 font-semibold">
          <Zap className="w-4 h-4 text-cyan-400" />
          <span>Ready for Venture-Backed Scale</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Navigation Topic List */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">
            Blueprint Deliverables
          </h3>
          <div className="space-y-1">
            {BLUEPRINT_TOPICS.map((topic) => {
              const isSelected = topic.id === selectedTopicId;
              return (
                <button
                  key={topic.id}
                  onClick={() => setSelectedTopicId(topic.id)}
                  className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600/20 border border-indigo-500/40 text-white font-bold'
                      : 'hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <div>
                    <span className="text-[10px] font-semibold text-indigo-400 block">{topic.badge}</span>
                    <h4 className="text-xs">{topic.title}</h4>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-cyan-400' : 'text-slate-600'}`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Topic Content Display */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-cyan-400 block">{selectedTopic.badge}</span>
              <h3 className="text-lg font-bold text-white">{selectedTopic.title}</h3>
            </div>
            <span className="text-xs px-2.5 py-1 rounded bg-slate-950 text-slate-300 border border-slate-800">
              Venture Architecture
            </span>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap space-y-4">
            {selectedTopic.detailsMarkdown}
          </div>
        </div>
      </div>
    </div>
  );
};
