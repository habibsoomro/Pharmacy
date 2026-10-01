"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { loadCurrentScan, saveCurrentScan, type CurrentScan } from "@/lib/client/scan-session";
import { fullSafetyCheck, localReport, safetyKey } from "@/lib/client/safety";
import type { SafetyReport } from "@/lib/schemas/safety";
import { SafetyPanel } from "@/components/summary/SafetyPanel";

// TEMPORARY (Stage 5): safety check + a plain medicine list. Stage 6 builds all the summary cards.
export function SummaryPlaceholder() {
  const { t } = useI18n();
  const [scan, setScan] = useState<CurrentScan | null>(null);
  const [report, setReport] = useState<SafetyReport | null>(null);
  const [pending, setPending] = useState(false);
  const running = useRef(false); // never run two checks at once

  const run = useCallback(async (s: CurrentScan) => {
    if (!s.result.is_prescription || running.current) return;
    const rx = s.result;
    const key = safetyKey(rx);
    if (s.safety?.key === key && s.safety.report.aiChecked) {
      setReport(s.safety.report); // already checked and nothing changed
      return;
    }
    running.current = true;
    setReport(localReport(rx)); // show our own results straight away
    setPending(true);
    try {
      const full = await fullSafetyCheck(rx);
      setReport(full);
      saveCurrentScan({ ...s, safety: { key, report: full } });
    } finally {
      setPending(false);
      running.current = false;
    }
  }, []);

  useEffect(() => {
    const s = loadCurrentScan();
    setScan(s);
    if (s) run(s);
  }, [run]);

  const rx = scan?.result.is_prescription ? scan.result : null;
  return (
    <div className="space-y-6">
      {rx && <SafetyPanel report={report} pending={pending} onRetry={() => scan && run(scan)} />}
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
