"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LanguageScope, useI18n } from "@/components/I18nProvider";
import { useSettings } from "@/components/SettingsProvider";
import { site } from "@/config/site";
import { pick } from "@/lib/locales";
import { LANG_INFO, scriptClass, type SummaryLang } from "@/lib/languages";
import { HIDEABLE_CARDS, type HideableCard } from "@/lib/settings";
import { loadCurrentScan, saveCurrentScan, type CurrentScan } from "@/lib/client/scan-session";
import { fullSafetyCheck, localReport, safetyKey } from "@/lib/client/safety";
import { downloadSummaryPdf } from "@/lib/client/pdf";
import { withLightTheme } from "@/lib/client/theme";
import { fmt } from "@/lib/format";
import type { Prescription } from "@/lib/schemas/extraction";
import type { SafetyReport } from "@/lib/schemas/safety";
import { translatable } from "@/lib/translate/core";
import { defaultStartDate } from "@/lib/summary/dates";
import { fullText, summaryTexts, type ShareCtx } from "@/lib/summary/share-text";
import {
  CalendarCard, CareCard, DiagnosisCard, DispensingCard, DoctorCard, InteractionsCard, MedicineCard, PatientCard, SafetyAlertsCard, TimetableCard,
} from "@/components/summary/cards";
import { copyText, whatsappShare } from "@/components/summary/SummaryCard";
import { SpeechProvider, useSpeech } from "@/components/summary/Speech";
import { SaveBar } from "@/components/summary/SaveBar";
import { PoorLegibilityWarning } from "@/components/PoorLegibilityWarning";
import { SummarySkeleton } from "@/components/Skeletons";
import { useSummaryTranslation, type TranslationStatus } from "@/components/summary/useSummaryTranslation";
import { AlertIcon, CheckIcon, GearIcon, PauseIcon, SpeakerIcon, SpinnerIcon, StopIcon, WhatsAppIcon } from "@/components/icons";

export function SummaryScreen() {
  const { t: siteT, locale } = useI18n();
  const { settings, loaded } = useSettings();
  const [scan, setScan] = useState<CurrentScan | null | undefined>(undefined);
  const [report, setReport] = useState<SafetyReport | null>(null);
  const [pending, setPending] = useState(false);
  const [start, setStart] = useState<string | null>(null);
  const running = useRef(false);

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

  const lang: SummaryLang = settings.summaryLang ?? locale;
  const rx = scan?.result.is_prescription ? scan.result : null;
  const notes = useMemo(() => scan?.review?.medicineNotes ?? [], [scan]);
  const generalNote = scan?.review?.generalNote ?? "";
  const sources = useMemo(() => (rx ? translatable(summaryTexts({ rx, safety: report, notes, generalNote })) : []), [rx, report, notes, generalNote]);
  const translation = useSummaryTranslation({ lang, level: settings.level, siteDict: siteT, sources, enabled: loaded && !!rx });

  if (scan === undefined || !loaded) return <SummarySkeleton />;
  if (!scan || !rx || !start) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-8">
        <p className="rounded-xl border border-line bg-card p-5">{siteT.review.noScan}</p>
        <Link href="/scan" className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-brand px-5 font-semibold text-white">{siteT.review.scanNow}</Link>
      </div>
    );
  }

  return (
    <LanguageScope lang={lang} dict={translation.dict}>
      <SpeechProvider lang={lang} rate={settings.speechRate === "slow" ? 0.8 : 1}>
        <SummaryBody
          scan={scan}
          rx={rx}
          report={report}
          pending={pending}
          start={start}
          onStartChange={(iso) => {
            setStart(iso);
            const latest = loadCurrentScan();
            if (latest) saveCurrentScan({ ...latest, startDate: iso });
          }}
          onRetrySafety={() => runSafety(scan)}
          onSaved={setScan}
          translation={translation}
        />
      </SpeechProvider>
    </LanguageScope>
  );
}

function SummaryBody({ scan, rx, report, pending, start, onStartChange, onRetrySafety, onSaved, translation }: {
  scan: CurrentScan; rx: Prescription; report: SafetyReport | null; pending: boolean; start: string;
  onStartChange: (iso: string) => void; onRetrySafety: () => void; onSaved: (scan: CurrentScan) => void;
  translation: ReturnType<typeof useSummaryTranslation>;
}) {
  const { t, lang, locale } = useI18n();
  const { settings, update, setOpen } = useSettings();
  const [pdfState, setPdfState] = useState<"idle" | "making" | "failed">("idle");
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const pharmacist = settings.view === "pharmacist";
  const ctx: ShareCtx = {
    t, lang, rx, safety: report, start,
    notes: scan.review?.medicineNotes ?? [], generalNote: scan.review?.generalNote ?? "",
    tx: translation.tx, detailed: settings.level === "detailed", pharmacist,
  };

  const applicable = HIDEABLE_CARDS.filter((c) => c !== "dispensing" || pharmacist);
  const shown = (card: HideableCard) => applicable.includes(card) && !settings.hiddenCards.includes(card);
  const hiddenCount = applicable.filter((c) => settings.hiddenCards.includes(c)).length;

  const pharmacy = pick(site.name, locale);
  const alertsFor = (i: number) => (report?.alerts ?? []).filter((a) => a.medIndexes.includes(i));
  const everything = () => fullText(ctx, pharmacy, shown);
  const otherLang = lang !== locale;

  async function makePdf() {
    if (!contentRef.current) return;
    setPdfState("making");
    try {
      await withLightTheme(() => downloadSummaryPdf(contentRef.current!, `prescription-summary-${start}.pdf`));
      setPdfState("idle");
    } catch {
      setPdfState("failed");
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6">
      <div
        ref={contentRef}
        className={`space-y-4 ${otherLang ? scriptClass(lang) : ""}`}
        lang={otherLang ? LANG_INFO[lang].tag : undefined}
        dir={otherLang ? LANG_INFO[lang].dir : undefined}
      >
        <header data-pdf-block className="space-y-3 bg-surface pb-1">
          <h1 className="text-2xl font-bold text-brand sm:text-3xl">{t.summary.title}</h1>
          <p className="hidden text-sm text-muted print:block [.pdf-mode_&]:block">{pharmacy}</p>
          <p className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-950">
            <AlertIcon className="mt-0.5 size-4 shrink-0" />
            {t.common.disclaimer}
          </p>
        </header>

        {rx.overall_legibility === "poor" && <PoorLegibilityWarning />}

        <TranslationBanner status={translation.status} lang={lang} onRetry={translation.retry} />

        {/* Whole-summary actions */}
        <div className="no-print rounded-2xl border border-line bg-card p-3">
          <p className="mb-2 text-sm font-medium text-muted">{t.summary.actions.shareTitle}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button type="button" onClick={() => whatsappShare(everything())}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-whatsapp font-semibold text-white">
              <WhatsAppIcon className="size-5" />{t.summary.actions.whatsapp}
            </button>
            <button type="button" onClick={async () => { if (await copyText(everything())) { setCopied(true); setTimeout(() => setCopied(false), 2000); } }}
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
          <div className="mt-2 grid grid-cols-2 gap-2">
            <ReadAloudButton text={everything} />
            <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-line font-semibold hover:border-brand">
              <GearIcon className="size-5" />{t.summary.actions.settings}
            </button>
          </div>
          <SpeechNotice />
        </div>

        <SaveBar scan={scan} onSaved={onSaved} />

        <div data-pdf-block><SafetyAlertsCard ctx={ctx} stillFlagged={scan.review?.stillFlagged ?? 0} unreadable={rx.unreadable_fields} /></div>
        {shown("dispensing") && <div data-pdf-block><DispensingCard ctx={ctx} /></div>}
        {shown("patient") && <div data-pdf-block><PatientCard ctx={ctx} /></div>}
        {shown("doctor") && <div data-pdf-block><DoctorCard ctx={ctx} /></div>}
        {shown("diagnosis") && <div data-pdf-block><DiagnosisCard ctx={ctx} /></div>}
        {shown("medicines") && rx.medicines.map((_, i) => (
          <div key={i} data-pdf-block><MedicineCard ctx={ctx} index={i} alerts={alertsFor(i)} /></div>
        ))}
        {shown("timetable") && <div data-pdf-block><TimetableCard ctx={ctx} /></div>}
        {shown("calendar") && <div data-pdf-block><CalendarCard ctx={ctx} onStartChange={onStartChange} /></div>}
        {shown("interactions") && <div data-pdf-block><InteractionsCard ctx={ctx} pending={pending} onRetry={onRetrySafety} /></div>}
        {shown("care") && <div data-pdf-block><CareCard ctx={ctx} /></div>}

        {hiddenCount > 0 && (
          <div className="no-print flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-line p-3 text-sm text-muted">
            <span>{fmt(t.summary.hidden.text, { n: hiddenCount })}</span>
            <button type="button" onClick={() => update({ hiddenCards: [] })} className="min-h-10 rounded-lg border-2 border-brand px-3 font-semibold text-brand">
              {t.summary.hidden.showAll}
            </button>
          </div>
        )}

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

function TranslationBanner({ status, lang, onRetry }: { status: TranslationStatus; lang: SummaryLang; onRetry: () => void }) {
  const { t } = useI18n();
  const tr = t.summary.translate;
  if (status === "idle") return null;
  const name = LANG_INFO[lang].label;
  return (
    <div className="no-print space-y-1" aria-live="polite">
      {status === "working" && (
        <p className="flex items-center gap-2 rounded-xl bg-card p-3 text-sm text-brand"><SpinnerIcon className="size-4" />{fmt(tr.working, { lang: name })}</p>
      )}
      {status === "failed" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <span>{tr.failed}</span>
          <button type="button" onClick={onRetry} className="min-h-10 rounded-lg border-2 border-brand px-3 font-semibold text-brand">{tr.retry}</button>
        </div>
      )}
      <p className="text-xs text-muted">{tr.aiNote}</p>
    </div>
  );
}

function ReadAloudButton({ text }: { text: () => string }) {
  const { t } = useI18n();
  const speech = useSpeech();
  const a = t.summary.actions;
  if (!speech) return null;
  const readingAll = speech.current === "all";
  if (!readingAll) {
    return (
      <button type="button" onClick={() => speech.speak("all", text())}
        className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-brand font-semibold text-brand">
        <SpeakerIcon className="size-5" />{a.readAloud}
      </button>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={speech.status === "paused" ? speech.resume : speech.pause}
        className="flex min-h-12 items-center justify-center gap-1 rounded-xl border-2 border-brand text-sm font-semibold text-brand">
        {speech.status === "paused" ? <SpeakerIcon className="size-5" /> : <PauseIcon className="size-5" />}
        {speech.status === "paused" ? a.resume : a.pause}
      </button>
      <button type="button" onClick={speech.stop} className="flex min-h-12 items-center justify-center gap-1 rounded-xl bg-brand text-sm font-semibold text-white">
        <StopIcon className="size-5" />{a.stop}
      </button>
    </div>
  );
}

/** Explains when the phone can't read aloud in this language, and offers the Urdu voice where it helps. */
function SpeechNotice() {
  const { t } = useI18n();
  const speech = useSpeech();
  const p = speech?.problem;
  if (!speech || !p) return null;
  const s = t.summary.speech;
  return (
    <div className="mt-2 space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status">
      {p.kind === "unsupported" ? (
        <p>{s.unsupported}</p>
      ) : (
        <>
          <p className="font-semibold">{fmt(s.noVoice, { lang: LANG_INFO[p.lang].label })}</p>
          <p>{s.installHint}</p>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {p.kind === "noVoice" && p.urduAvailable && (
          <button type="button" onClick={() => speech.speak(p.id, p.text, { useUrduVoice: true })} className="min-h-10 rounded-lg bg-brand px-3 font-semibold text-white">
            {s.useUrdu}
          </button>
        )}
        <button type="button" onClick={speech.dismissProblem} className="min-h-10 rounded-lg border-2 border-line px-3 font-semibold">{s.dismiss}</button>
      </div>
    </div>
  );
}
