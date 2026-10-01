"use client";

import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";

/** Checkbox shown before the first scan, explaining that the photo goes to an AI service. */
export function ConsentBox({ checked, onChange, showError }: { checked: boolean; onChange: (v: boolean) => void; showError: boolean }) {
  const { t } = useI18n();
  return (
    <div className={`rounded-xl border p-4 ${showError ? "border-red-400 bg-red-50" : "border-line bg-card"}`}>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1.5 size-6 shrink-0 accent-[var(--brand)]"
          aria-describedby={showError ? "consent-error" : undefined}
        />
        <span className="text-sm">{t.scan.consent.label}</span>
      </label>
      <Link href="/privacy" target="_blank" className="ms-9 mt-1 inline-block text-sm text-brand underline underline-offset-4">
        {t.scan.consent.privacyLink}
      </Link>
      {showError && (
        <p id="consent-error" className="ms-9 mt-1 text-sm font-medium text-red-700" role="alert">
          {t.scan.consent.required}
        </p>
      )}
    </div>
  );
}
