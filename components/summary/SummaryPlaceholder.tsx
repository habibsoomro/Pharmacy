"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { loadCurrentScan, type CurrentScan } from "@/lib/client/scan-session";

// TEMPORARY (Stage 4): confirms the checked prescription arrived. Stage 6 builds the real summary cards.
export function SummaryPlaceholder() {
  const { t } = useI18n();
  const [scan, setScan] = useState<CurrentScan | null>(null);
  useEffect(() => setScan(loadCurrentScan()), []);
  const rx = scan?.result.is_prescription ? scan.result : null;

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-dashed border-line bg-card p-5 text-muted">{t.summary.comingSoon}</p>
      {rx && (
        <ul dir="ltr" className="latin list-disc space-y-1 ps-6 text-sm" data-testid="summary-medicines">
          {rx.medicines.map((m, i) => (
            <li key={i}>
              {[m.brand_name, m.strength, m.dose_per_time, m.frequency_text, m.duration_days && `${m.duration_days} days`, m.total_quantity_needed].filter(Boolean).join(" · ")}
            </li>
          ))}
        </ul>
      )}
      <Link href="/review" className="inline-flex min-h-12 items-center rounded-xl border-2 border-brand px-5 font-semibold text-brand">
        {t.summary.backToReview}
      </Link>
    </div>
  );
}
