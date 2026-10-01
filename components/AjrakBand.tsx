/**
 * A thin strip inspired by Sindhi ajrak block-print: indigo ground,
 * madder-red border lines and a repeating white star-and-diamond motif.
 */
export function AjrakBand({ className = "" }: { className?: string }) {
  return (
    <svg className={`block h-3 w-full ${className}`} aria-hidden="true" focusable="false" preserveAspectRatio="none">
      <defs>
        <pattern id="ajrak" width="24" height="12" patternUnits="userSpaceOnUse">
          <rect width="24" height="12" fill="var(--brand)" />
          <rect width="24" height="1.5" fill="var(--madder)" />
          <rect y="10.5" width="24" height="1.5" fill="var(--madder)" />
          <path d="M6 3.2 L8.8 6 L6 8.8 L3.2 6 Z" fill="#ffffff" />
          <circle cx="6" cy="6" r="1" fill="var(--madder)" />
          <circle cx="18" cy="6" r="1.4" fill="#ffffff" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#ajrak)" />
    </svg>
  );
}
