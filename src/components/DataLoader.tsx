import React from 'react';
import { Loader2 } from 'lucide-react';

type DataLoaderVariant = 'page' | 'panel' | 'inline' | 'overlay';

export function DataLoader({
  label = 'Loading…',
  variant = 'panel',
}: {
  label?: string;
  variant?: DataLoaderVariant;
}) {
  const spinnerClass =
    variant === 'inline'
      ? 'h-3.5 w-3.5 animate-spin text-[color:var(--accent)]'
      : 'h-5 w-5 animate-spin text-[color:var(--accent)]';

  if (variant === 'inline') {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-slate-400">
        <Loader2 className={spinnerClass} />
        {label}
      </span>
    );
  }

  if (variant === 'overlay') {
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] bg-[#070b12]/75">
        <div className="flex flex-col items-center gap-3 px-4 text-center">
          <Loader2 className={spinnerClass} />
          <p className="text-sm text-slate-300">{label}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 text-sm text-slate-400 ${
        variant === 'page' ? 'min-h-[50vh]' : 'min-h-[240px]'
      }`}
    >
      <Loader2 className={spinnerClass} />
      <p>{label}</p>
    </div>
  );
}
