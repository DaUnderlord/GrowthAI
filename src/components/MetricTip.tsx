import React, { useId, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { METRIC_TIPS, type MetricKey } from '../lib/metricExplain';

export function MetricTip({
  metric,
  align = 'left',
  className = '',
}: {
  metric: MetricKey;
  align?: 'left' | 'right';
  className?: string;
}) {
  const tip = METRIC_TIPS[metric];
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={`What ${tip.title} means`}
        aria-describedby={id}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        onBlur={() => setOpen(false)}
        className="group inline-flex rounded-full p-0.5 text-slate-500 transition hover:text-cyan-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/80"
      >
        <CircleHelp className="h-3.5 w-3.5" />
        <span
          id={id}
          role="tooltip"
          className={`${open ? 'visible opacity-100' : 'invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100'} pointer-events-none absolute z-50 mt-6 w-64 rounded-xl border border-white/10 bg-[#0d1520] p-3 text-left shadow-xl transition-opacity ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-cyan-200">{tip.title}</span>
          <span className="mt-1.5 block text-[11px] leading-5 text-slate-300">{tip.body}</span>
        </span>
      </button>
    </span>
  );
}

export function MetricLabel({
  metric,
  children,
  align,
  className = '',
}: {
  metric: MetricKey;
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {children}
      <MetricTip metric={metric} align={align} />
    </span>
  );
}
