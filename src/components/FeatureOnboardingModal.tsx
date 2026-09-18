import React, { useState } from 'react';
import {
  BarChart2,
  Calendar,
  Link2,
  MessageCircle,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { BrandMark } from './BrandIcons';
import { navigateView } from '../lib/liveApi';

const STEPS = [
  {
    icon: Sparkles,
    title: 'Welcome to GrowthOS',
    body: 'Your agency workspace for campaigns, content, WhatsApp, and live channel metrics across the brands you manage.',
  },
  {
    icon: Link2,
    title: 'Connect your own apps',
    body: 'In Agency Hub → Connect apps, save Meta (App ID, Secret, and Login for Business Configuration ID), Google, TikTok, or LinkedIn for your workspace, then sign in for the brand you selected.',
  },
  {
    icon: BarChart2,
    title: 'Live metrics only after sync',
    body: 'Overview, Audience, and Analytics stay empty until a brand account is connected and synced. Audience segments come from the provider’s demographic breakdown, not invented personas.',
  },
  {
    icon: Target,
    title: 'Growth AI Suite',
    body: 'Growth AI can draft campaigns and creative once you have a brand. Paid reboost and ad metrics need a connected ads account.',
  },
  {
    icon: Calendar,
    title: 'Campaigns & calendar',
    body: 'Plan campaigns and schedule posts. Instagram and Facebook Page items publish at the scheduled time once the professional account is connected with publishing permission. Campaign numbers stay at zero until live data exists.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp, team, invoices',
    body: 'WhatsApp uses your Meta Cloud API number (Phone Number ID + token). Invite teammates with roles. Invoices are records you can email — card payments are off.',
  },
];

interface FeatureOnboardingModalProps {
  isOpen: boolean;
  userName?: string;
  onComplete: () => void;
}

export const FeatureOnboardingModal: React.FC<FeatureOnboardingModalProps> = ({
  isOpen,
  userName,
  onComplete,
}) => {
  const [step, setStep] = useState(0);

  if (!isOpen) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  const finish = (openHub: boolean) => {
    if (openHub) navigateView('agency', { tab: 'apps' });
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#070b12]/85 p-4 backdrop-blur-md">
      <div className="fade-rise relative w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#0a1018] p-6 shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={() => finish(false)}
          className="absolute right-4 top-4 rounded-lg p-2 text-slate-500 transition hover:bg-white/[0.04] hover:text-white"
          aria-label="Skip tour"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-6 flex items-center gap-3">
          <BrandMark className="h-10 w-10 rounded-xl" />
          <div>
            <p className="text-[11px] uppercase tracking-wider text-cyan-300/80">Quick tour</p>
            <h2 className="font-display text-2xl font-medium text-white">
              {userName ? `Hi ${userName.split(' ')[0]}` : 'Welcome'}
            </h2>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-slate-950/60 p-5">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
            <Icon className="h-6 w-6" />
          </div>
          <h3 className="font-display text-xl font-medium text-white">{current.title}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-400">{current.body}</p>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {STEPS.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all ${
                  idx === step ? 'w-6 bg-cyan-400' : 'w-1.5 bg-slate-700'
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button type="button" onClick={() => setStep((s) => s - 1)} className="secondary-button">
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (isLast) finish(true);
                else setStep((s) => s + 1);
              }}
              className="primary-button"
            >
              {isLast ? 'Connect my apps' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
