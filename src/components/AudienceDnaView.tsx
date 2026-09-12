import React, { useMemo } from 'react';
import { Clock, Heart, ShoppingBag } from 'lucide-react';
import { ClientProfile } from '../types';
import { useLiveInsights } from '../lib/liveApi';
import { useWorkspaceLocale } from '../lib/WorkspaceLocale';
import { ConnectAccountsPrompt } from './ConnectAccountsPrompt';

interface AudienceDnaProps {
  client: ClientProfile;
}

export const AudienceDnaView: React.FC<AudienceDnaProps> = ({ client }) => {
  const { insights } = useLiveInsights(client.id);
  const { t } = useWorkspaceLocale();
  const personas = useMemo(
    () => (insights?.personas?.length ? insights.personas : []),
    [insights]
  );

  return (
    <div className="space-y-6">
      <div className="surface-panel p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow-label">{t('audience')}</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">{t('audience')}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">{t('personasFromProvider')}</p>
          </div>
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-100">
            Audience signals for {client.name}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {personas.length === 0 && (
          <div className="space-y-4 lg:col-span-3">
            <ConnectAccountsPrompt client={client} needed={['meta', 'linkedin']} />
            <div className="surface-panel space-y-2 p-6 text-sm text-slate-400">
              <p>{t('audienceEmpty')}</p>
              {(insights?.demographics?.notes || []).map((note) => (
                <p key={note} className="text-xs text-amber-300">
                  {note}
                </p>
              ))}
            </div>
          </div>
        )}
        {personas.map((persona) => (
          <div key={persona.id} className="surface-panel space-y-4 p-5">
            <div className="flex items-start justify-between border-b border-white/10 pb-3">
              <div>
                <p className="eyebrow-label">{persona.segmentName}</p>
                <h3 className="mt-1 text-lg font-semibold text-white">{persona.name}</h3>
              </div>
              <span className="rounded-2xl border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-sm font-semibold text-indigo-200">
                {persona.percentage}%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="surface-subtle p-3">
                <p className="text-[11px] text-slate-500">Age bracket</p>
                <p className="mt-1 font-medium text-white">{persona.ageRange} years</p>
              </div>
              <div className="surface-subtle p-3">
                <p className="text-[11px] text-slate-500">Purchasing power</p>
                <p className="mt-1 font-medium text-emerald-300">{persona.purchasingPower}</p>
              </div>
            </div>

            <div className="surface-subtle p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
                <Clock className="h-3.5 w-3.5 text-amber-300" />
                <span>Peak active hours</span>
              </div>
              <p className="mt-2 text-sm text-cyan-200">{persona.activeHours}</p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
                <Heart className="h-3.5 w-3.5 text-pink-300" />
                <span>Core interests</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {persona.interests.map((interest, idx) => (
                  <span
                    key={idx}
                    className="rounded-full border border-white/10 bg-slate-950/60 px-2.5 py-1 text-[11px] text-slate-300"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
                <ShoppingBag className="h-3.5 w-3.5 text-emerald-300" />
                <span>Buying triggers</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                {persona.buyingTriggers.map((trigger, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="text-emerald-300">•</span>
                    <span>{trigger}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-indigo-400/20 bg-indigo-400/10 p-4 text-sm">
              <p className="eyebrow-label text-indigo-200">Preferred content format</p>
              <p className="mt-2 font-medium text-white">{persona.preferredFormat}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
