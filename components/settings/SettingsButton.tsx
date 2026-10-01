"use client";

import { useSettings } from "@/components/SettingsProvider";
import { GearIcon } from "@/components/icons";

/** Gear button that opens the Settings panel. `withLabel` shows the word next to the icon. */
export function SettingsButton({ label, withLabel = false, className = "" }: { label: string; withLabel?: boolean; className?: string }) {
  const { setOpen } = useSettings();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={withLabel ? undefined : label}
      aria-haspopup="dialog"
      className={`flex shrink-0 items-center justify-center gap-2 rounded-full ${className}`}
    >
      <GearIcon className="size-5" />
      {withLabel && <span>{label}</span>}
    </button>
  );
}
