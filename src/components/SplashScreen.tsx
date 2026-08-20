import React, { useEffect, useState } from 'react';
import { BrandMark } from './BrandIcons';

interface SplashScreenProps {
  onFinished?: () => void;
  minDurationMs?: number;
  ready?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinished,
  minDurationMs = 1600,
  ready = false,
}) => {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!ready || leaving) return;

    const timer = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => onFinished?.(), 420);
    }, minDurationMs);

    return () => clearTimeout(timer);
  }, [ready, minDurationMs, onFinished, leaving]);

  return (
    <div
      className={`fixed inset-0 z-[100] overflow-hidden bg-[#070b12] transition-opacity duration-[420ms] ${
        leaving ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <img
        src="/brand/splash-hero.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#070b12] via-[#070b12]/75 to-[#070b12]/35" />
      <div className="splash-glow absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(ellipse_at_center,rgba(142,200,216,0.18),transparent_65%)]" />

      <div className="relative z-10 flex min-h-full flex-col items-center justify-center px-6 text-center">
        <BrandMark className="h-16 w-16 rounded-2xl shadow-2xl shadow-black/40 fade-rise" />
        <h1 className="font-display mt-7 text-4xl font-medium tracking-tight text-white fade-rise-delay sm:text-5xl">
          GrowthOS
        </h1>
        <p className="mt-3 max-w-sm text-sm leading-6 text-slate-300 fade-rise-delay">
          Growth that stays calm
        </p>
        <div className="mt-10 h-px w-24 bg-gradient-to-r from-transparent via-[#8ec8d8]/70 to-transparent fade-rise-delay" />
      </div>
    </div>
  );
};
