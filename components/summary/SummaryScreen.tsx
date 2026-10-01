"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { site } from "@/config/site";
import { pick } from "@/lib/locales";
import { loadCurrentScan, saveCurrentScan, type CurrentScan } from "@/lib/client/scan-session";
import { fullSafetyCheck, localReport, safetyKey } from "@/lib/client/safety";
import { downloadSummaryPdf } from "@/lib/client/pdf";
import type { SafetyReport } from "@/lib/schemas/safety";
import { defaultStartDate } from "@/lib/summary/dates";
import { fullText, type ShareCtx } from "@/lib/summary/share-text";
import {
  CalendarCard, CareCard, DiagnosisCard, DoctorCard, InteractionsCard, MedicineCard, PatientCard, SafetyAlertsCard, TimetableCard,
} from "@/components/summary/cards";
import { copyText, whatsappShare } from "@/components/summary/SummaryCard";
import { AlertIcon, CheckIcon, SpinnerIcon, WhatsAppIcon } from "@/components/icons";

export function SummaryScreen() {
  const { t, locale } = useI18n();
  const [scan, setScan] = useState<CurrentScan | null | undefined>(undefined);
  const [report, setReport] = useState<SafetyReport | null>(null);
  const [pending, setPending] = useState(false);
  const [start, setStart] = useState<string | null>(null);
  const [pdfState, setPdfState] = useState<"idle" | "making" | "failed">("idle");
  const [copied, setCopied] = useState(false);
  const running = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const runSafety = useCallback(async (s: CurrentScan) => {
    if (!s.result.is_prescription || running.current) return;
    const rx = s.result;
    const key = safetyKey(rx);
    if (s.safety?.key === key && s.safety.report.aiChecked) {
      setReport(s.safety.report);
      return;
    }
    running.current = true;
    setReport(localReport(rx)); // the pharmacy's own checks show straight away
    setPending(true);
    try {
      const full = await fullSafetyCheck(rx);
      setReport(full);
      const latest = loadCurrentScan() ?? s;
      saveCurrentScan({ ...latest, safety: { key, report: full } });
    } finally {
      setPending(false);
      running.current = false;
    }
  }, []);

  useEffect(() => {
    const s = loadCurrentScan();
    setScan(s);
    if (s?.result.is_prescription) {
      setStart(s.startDate ?? defaultStartDate(s.result.prescription_date.value));
      runSafety(s);
    }
  }, [runSafety]);

  const ctx: ShareCtx | null = useMemo(() => {
    if (!scan?.result.is_prescription || !start) return null;
    return { t, locale, rx: scan.result, safety: report, start, notes: scan.review?.medicineNotes ?? [], generalNote: scan.review?.generalNote ?? "" };
  }, [scan, report, start, t, locale]);

  if (scan === undefined) return null;
  if (!ctx || !scan) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-8">
        <p className="rounded-xl border border-line bg-card p-5">{t.review.noScan}</p>
        <Link href="/scan" className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-brand px-5 font-semibold text-white">{t.review.scanNow}</Link>
      </div>
    );
  }

  const pharmacy = pick(site.name, locale);
  const alertsFor = (i: number) => (report?.alerts ?? []).filter((a) => a.medIndexes.includes(i));
  const unreadable = scan.result.is_prescription ? scan.result.unreadable_fields : [];

  function changeStart(iso: string) {
    setStart(iso);
    const latest = loadCurrentScan();
    if (latest) saveCurrentScan({ ...latest, startDate: iso });
  }

  async function makePdf() {
    if (!contentRef.current) return;
    setPdfState("making");
    try {
      await downloadSummaryPdf(contentRef.current, `prescription-summary-${start}.pdf`);
      setPdfState("idle");
    } catch {
      setPdfState("failed");
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6">
      <div ref={contentRef} className="space-y-4">
        <header data-pdf-block className="space-y-3 bg-surface pb-1">
          <h1 className="text-2xl font-bold text-brand sm:text-3xl">{t.summary.title}</h1>
          <p className="hidden text-sm text-muted print:block [.pdf-mode_&]:block">{pharmacy}</p>
          <p className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-950">
            <AlertIcon className="mt-0.5 size-4 shrink-0" />
            {t.common.disclaimer}
          </p>
        </header>

        {/* Whole-summary actions */}
        <div className="no-print rounded-2xl border border-line bg-card p-3">
          <p className="mb-2 text-sm font-medium text-muted">{t.summary.actions.shareTitle}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button type="button" onClick={() => whatsappShare(fullText(ctx, pharmacy))}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-whatsapp font-semibold text-white">
              <WhatsAppIcon className="size-5" />{t.summary.actions.whatsapp}
            </button>
            <button type="button" onClick={async () => { if (await copyText(fullText(ctx, pharmacy))) { setCopied(true); setTimeout(() => setCopied(false), 2000); } }}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-brand font-semibold text-brand">
              {copied && <CheckIcon className="size-5" />}{copied ? t.summary.actions.copied : t.summary.actions.copy}
            </button>
            <button type="button" onClick={() => window.print()} className="min-h-12 rounded-xl border-2 border-brand font-semibold text-brand">
              {t.summary.actions.print}
            </button>
            <button type="button" onClick={makePdf} disabled={pdfState === "making"}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-white disabled:opacity-70">
              {pdfState === "making" && <SpinnerIcon className="size-5" />}
              {pdfState === "making" ? t.summary.actions.pdfMaking : t.summary.actions.pdf}
            </button>
          </div>
          {pdfState === "failed" && <p className="mt-2 text-sm text-red-700" role="alert">{t.summary.actions.pdfFailed}</p>}
        </div>

        <div data-pdf-block><SafetyAlertsCard ctx={ctx} stillFlagged={scan.review?.stillFlagged ?? 0} unreadable={unreadable} /></div>
        <div data-pdf-block><PatientCard ctx={ctx} /></div>
        <div data-pdf-block><DoctorCard ctx={ctx} /></div>
        <div data-pdf-block><DiagnosisCard ctx={ctx} /></div>
        {ctx.rx.medicines.map((_, i) => (
          <div key={i} data-pdf-block><MedicineCard ctx={ctx} index={i} alerts={alertsFor(i)} /></div>
        ))}
        <div data-pdf-block><TimetableCard ctx={ctx} /></div>
        <div data-pdf-block><CalendarCard ctx={ctx} onStartChange={changeStart} /></div>
        <div data-pdf-block><InteractionsCard ctx={ctx} pending={pending} onRetry={() => runSafety(scan)} /></div>
        <div data-pdf-block><CareCard ctx={ctx} /></div>

        <p data-pdf-block className="flex gap-2 rounded-xl bg-card p-3 text-sm text-muted">
          <AlertIcon className="mt-0.5 size-4 shrink-0" />
          {t.common.disclaimer}
        </p>
      </div>

      <div className="no-print mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href="/review" className="flex min-h-12 flex-1 items-center justify-center rounded-xl border-2 border-brand font-semibold text-brand">{t.summary.backToReview}</Link>
        <Link href="/scan" className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-brand font-semibold text-white">{t.summary.scanAnother}</Link>
      </div>
    </div>
  );
}
