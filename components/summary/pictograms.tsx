// Simple pictures for times of day and food, for people who read little.
type P = { className?: string };
const s = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const MorningIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...s}>
    <path d="M3 18h18M6 18a6 6 0 0 1 12 0M12 6V3M5.6 9.6 3.5 7.5M18.4 9.6l2.1-2.1" />
  </svg>
);
export const NoonIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...s}>
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
  </svg>
);
export const EveningIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...s}>
    <path d="M3 18h18M7 18a5 5 0 0 1 10 0M12 9v3M8 21h8" />
  </svg>
);
export const NightIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...s}>
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </svg>
);
export const PlateIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...s}>
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="3.5" />
    <path d="M2 4v5a1.5 1.5 0 0 0 3 0V4M3.5 9v11M22 4c-1.5 0-2.5 2-2.5 5h2.5M22 4v16" />
  </svg>
);
export const NoPlateIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...s}>
    <circle cx="12" cy="12" r="8" />
    <path d="M6.3 6.3l11.4 11.4" />
  </svg>
);
export const SLOT_ICONS = { morning: MorningIcon, afternoon: NoonIcon, evening: EveningIcon, night: NightIcon } as const;
