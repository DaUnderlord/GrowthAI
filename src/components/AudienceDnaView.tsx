import React, { useMemo } from 'react';
import { Clock, Heart, ShoppingBag } from 'lucide-react';
import { AudiencePersona, ClientProfile } from '../types';

interface AudienceDnaProps {
  client: ClientProfile;
}

function buildPersonasForClient(client: ClientProfile): AudiencePersona[] {
  const connected = (client.platforms || []).filter((p) => p.connected);
  const topPlatform = [...connected].sort((a, b) => b.followers - a.followers)[0];
  const industry = client.industryLabel || client.industry;
  const goal = client.primaryGoal || 'growth';

  return [
    {
      id: `${client.id}-core`,
      name: `${client.name} Core Buyers`,
      segmentName: `Primary · ${industry}`,
      percentage: 44,
      ageRange: '25 - 40',
      activeHours: '7:00 PM - 10:00 PM',
      interests: [industry, goal.split('&')[0].trim(), topPlatform?.name || 'Social', 'Trust signals'].slice(0, 4),
      buyingTriggers: [
        `Proof tied to ${goal}`,
        connected.length ? `Social proof on ${topPlatform?.name || 'connected channels'}` : 'Clear offer messaging',
        'Low-friction CTA / booking path',
      ],
      preferredFormat: topPlatform?.id === 'tiktok' ? 'Short-form video & POV hooks' : 'Carousels + Reels with clear CTA',
      sentimentScore: client.sentimentScore || 88,
      purchasingPower: client.tier?.toLowerCase().includes('enterprise') ? 'High' : 'Medium',
    },
    {
      id: `${client.id}-growth`,
      name: 'High-Intent Explorers',
      segmentName: 'Consideration stage',
      percentage: 33,
      ageRange: '22 - 35',
      activeHours: '12:00 PM - 2:00 PM',
      interests: ['Comparisons', 'How-to content', industry, 'Offers'],
      buyingTriggers: ['Limited-time offers', 'Social comments / reviews', 'Demo or sample access'],
      preferredFormat: 'Before/after + FAQ Stories',
      sentimentScore: Math.max(70, (client.engagementHealth || 80) - 4),
      purchasingPower: 'Medium',
    },
    {
      id: `${client.id}-warm`,
      name: 'Warm Retargetable Audience',
      segmentName: 'Retention & upsell',
      percentage: 23,
      ageRange: '28 - 50',
      activeHours: '8:00 AM - 9:30 AM',
      interests: ['Loyalty perks', 'Community', industry, 'Product updates'],
      buyingTriggers: ['Reminder sequences', 'Bundles', 'Referral incentives'],
      preferredFormat: 'Email + DM sequences with social retargeting',
      sentimentScore: client.conversionScore || 82,
      purchasingPower: 'High',
    },
  ];
}

export const AudienceDnaView: React.FC<AudienceDnaProps> = ({ client }) => {
  const personas = useMemo(() => buildPersonasForClient(client), [client]);

  return (
    <div className="space-y-6">
      <div className="surface-panel p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow-label">Audience DNA</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Audience understanding without the clutter</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Personas are derived from {client.name}&apos;s industry, goal, and connected platforms — not a static demo dataset.
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-100">
            Audience signals for {client.name}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
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
