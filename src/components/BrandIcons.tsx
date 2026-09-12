import React from 'react';

type IconProps = {
  className?: string;
  active?: boolean;
};

const stroke = (active?: boolean) => (active ? '#d7eef4' : '#94a3b8');

/** Custom GrowthOS nav glyphs — not Lucide. */
export function OverviewIcon({ className, active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M4 16.5L9.2 11l3.3 3.2L20 7" stroke={stroke(active)} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.5 7H20v4.5" stroke={stroke(active)} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 19.5h16" stroke={stroke(active)} strokeWidth="1.2" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}

export function CampaignsIcon({ className, active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="7.2" stroke={stroke(active)} strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2.2" fill={active ? '#8ec8d8' : '#64748b'} />
      <path d="M12 4.8V7.2M12 16.8v2.4M4.8 12H7.2M16.8 12h2.4" stroke={stroke(active)} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function CalendarIcon({ className, active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="4" y="5.5" width="16" height="14" rx="2.2" stroke={stroke(active)} strokeWidth="1.5" />
      <path d="M4 9.5h16" stroke={stroke(active)} strokeWidth="1.4" />
      <path d="M8 4.5v3M16 4.5v3" stroke={stroke(active)} strokeWidth="1.5" strokeLinecap="round" />
      <rect x="8" y="12.2" width="3" height="3" rx="0.6" fill={active ? '#8ec8d8' : '#64748b'} />
    </svg>
  );
}

export function IntelligenceIcon({ className, active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 4.5c-2.8 0-5 2-5 5.1 0 1.7.8 3.1 2 4l.7 2.2h4.6l.7-2.2c1.2-.9 2-2.3 2-4 0-3.1-2.2-5.1-5-5.1Z"
        stroke={stroke(active)}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M9.8 18.2h4.4M10.4 20h3.2" stroke={stroke(active)} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12 8.2v2.8" stroke={active ? '#8ec8d8' : '#64748b'} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function AttributionIcon({ className, active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M5 18V10.5M10.5 18V7M16 18v-5.5M21 18H3" stroke={stroke(active)} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5 10.5l5.5-3.5L16 12.5l5-4" stroke={active ? '#8ec8d8' : '#64748b'} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AudienceIcon({ className, active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="9" cy="9" r="2.4" stroke={stroke(active)} strokeWidth="1.5" />
      <circle cx="16" cy="10.2" r="2" stroke={stroke(active)} strokeWidth="1.4" />
      <path d="M4.8 17.8c.6-2.2 2.5-3.5 4.2-3.5s3.6 1.3 4.2 3.5" stroke={stroke(active)} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13.2 17.8c.35-1.4 1.4-2.4 2.8-2.4 1.1 0 2 .5 2.5 1.4" stroke={active ? '#8ec8d8' : '#64748b'} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function SettingsIcon({ className, active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="2.6" stroke={stroke(active)} strokeWidth="1.5" />
      <path
        d="M12 4.5l1.1 1.7 2-.3.9 1.8 1.8.9-.3 2 1.7 1.1-1.7 1.1.3 2-1.8.9-.9 1.8-2-.3L12 19.5l-1.1-1.7-2 .3-.9-1.8-1.8-.9.3-2L4.8 12l1.7-1.1-.3-2 1.8-.9.9-1.8 2 .3L12 4.5Z"
        stroke={stroke(active)}
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AgencyIcon({ className, active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M4 19.5V8.5L12 4l8 4.5V19.5" stroke={stroke(active)} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 19.5v-5h6v5" stroke={active ? '#8ec8d8' : '#64748b'} strokeWidth="1.4" />
      <path d="M9 10.5h.01M12 10.5h.01M15 10.5h.01" stroke={stroke(active)} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function InvoicesIcon({ className, active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v14l-2.2-1.3-2.3 1.3-2-1.2-2 1.2-2.3-1.3L6 19V5A1.5 1.5 0 0 1 7.5 3.5H7Z" stroke={stroke(active)} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M9 8.5h6M9 12h6M9 15.5h3.5" stroke={active ? '#8ec8d8' : '#64748b'} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function TeamIcon({ className, active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="8.5" cy="9" r="2.3" stroke={stroke(active)} strokeWidth="1.5" />
      <circle cx="15.5" cy="9.5" r="2" stroke={stroke(active)} strokeWidth="1.4" />
      <path d="M4.5 17.5c.5-2 2.3-3.2 4-3.2s3.5 1.2 4 3.2" stroke={stroke(active)} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M13 17.5c.3-1.3 1.3-2.2 2.5-2.2 1 0 1.9.5 2.4 1.3" stroke={active ? '#8ec8d8' : '#64748b'} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function WhatsAppIcon({ className, active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 4.5c-3.9 0-7 3-7 6.7 0 1.3.4 2.5 1.1 3.5L5.2 19l4.5-1.2c1 .5 2.1.7 3.3.7 3.9 0 7-3 7-6.7s-3.1-6.7-7-6.7Z"
        stroke={stroke(active)}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 10.2c.2-.4.4-.4.7-.4h.5c.2 0 .4 0 .5.3l.6 1.4c.1.2 0 .4-.1.5l-.3.4c-.1.1-.2.3 0 .5.3.4.8.9 1.4 1.2.3.2.5.1.6 0l.4-.5c.1-.1.3-.2.5-.1l1.4.5c.3.1.4.2.4.5v.5c0 .3-.2.5-.5.6-.7.3-1.6.3-2.7-.3-1.3-.7-2.3-1.8-2.9-3.1-.3-.6-.4-1.2-.3-1.7.1-.3.3-.5.5-.6Z"
        fill={active ? '#8ec8d8' : '#64748b'}
      />
    </svg>
  );
}

export const NAV_ICONS = {
  overview: OverviewIcon,
  campaigns: CampaignsIcon,
  calendar: CalendarIcon,
  whatsapp: WhatsAppIcon,
  intelligence: IntelligenceIcon,
  attribution: AttributionIcon,
  audience: AudienceIcon,
  agency: AgencyIcon,
  invoices: InvoicesIcon,
  team: TeamIcon,
  settings: SettingsIcon,
  blueprint: SettingsIcon,
} as const;

export type NavIconId = keyof typeof NAV_ICONS;

export function BrandMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <img
      src="/brand/mark.png"
      alt="GrowthOS"
      className={`rounded-xl object-cover ${className}`}
    />
  );
}
