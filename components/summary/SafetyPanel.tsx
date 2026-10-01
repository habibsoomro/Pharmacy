"use client";

import { useI18n } from "@/components/I18nProvider";
import { fmt } from "@/lib/format";
import { fmtNode } from "@/lib/format-node";
import type { SafetyAlert, SafetyReport, Severity } from "@/lib/schemas/safety";
import { noTranslation, type Tx } from "@/lib/summary/share-text";
import { AlertIcon, CheckIcon, SpinnerIcon } from "@/components/icons";

// Colour codes from the brief: red = serious, orange = moderate, yellow = minor, green = none found.
const STYLE: Record<Severity, { card: string; pill: string; bar: string }> = {
  major: { card: "border-red-300 bg-red-50", pill: "bg-red-600 text-white", bar: "bg-red-600" },
  moderate: { card: "border-orange-300 bg-orange-50", pill: "bg-orange-500 text-white", bar: "bg-orange-500" },
  minor: { card: "border-yellow-300 bg-yellow-50", pill: "bg-yellow-300 text-yellow-950", bar: "bg-yellow-400" },
};

type Props = {
  report: SafetyReport | null; pending: boolean; onRetry?: () => void; embedded?: boolean;
  /** Translates the alert texts (they come from the AI or our list in English). */
  tx?: Tx;
  /** Show the kind of problem and where it was found (Detailed reading level or pharmacist view). */
  detailed?: boolean;
  /** Also show how sure the AI was (pharmacist view). */
  pharmacist?: boolean;
};

export function SafetyPanel({ report, pending, onRetry, embedded, tx = noTranslation, detailed = true, pharmacist = false }: Props) {
  const { t } = useI18n();
  const s = t.safety;

  if (!report) {
    return (
      <section className="rounded-2xl border border-line bg-card p-5" aria-busy="true">
        <p className="flex items-center gap-2 text-brand"><SpinnerIcon className="size-5" />{s.checking}</p>
        <div className="mt-4 space-y-3">
          {[0, 1].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-surface" />)}
        </div>
      </section>
    );
  }

  const count = (sev: Severity) => report.alerts.filter((a) => a.severity === sev).length;
  const none = report.alerts.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {!embedded && <h2 id="safety-title" className="text-xl font-bold text-brand">🚨 {s.title}</h2>}
        {!none && <p className="text-sm text-muted">{fmtNode(s.counts, { major: count("major"), moderate: count("moderate"), minor: count("minor") })}</p>}
      </div>

      {pending && (
        <>
          <p className="flex items-center gap-2 text-sm text-brand" role="status"><SpinnerIcon className="size-4" />{s.stillChecking}</p>
          <div className="h-24 animate-pulse rounded-2xl bg-surface" aria-hidden="true" />
        </>
      )}
      {!pending && !report.aiChecked && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-card p-3 text-sm text-muted">
          <span>{s.aiUnavailable}</span>
          {onRetry && <button type="button" onClick={onRetry} data-retry className="no-print min-h-9 rounded-lg border-2 border-brand px-3 font-semibold text-brand">{s.retry}</button>}
        </div>
      )}

      {none ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-white"><CheckIcon className="size-5" /></span>
          <div>
            <p className="font-semibold">{s.noneTitle}</p>
            <p className="text-sm">{s.noneText}</p>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {report.alerts.map((a) => <AlertCard key={a.id} a={a} tx={tx} detailed={detailed || pharmacist} pharmacist={pharmacist} />)}
        </ul>
      )}

      {report.ageWarnings.length > 0 && (
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="font-semibold">{s.ageTitle}</p>
          <ul className="mt-1 list-disc space-y-1 ps-5 text-sm">{report.ageWarnings.map((w) => <li key={w} dir="auto">{tx(w)}</li>)}</ul>
        </div>
      )}
      {report.pregnancyNote && (
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="font-semibold">{s.pregnancyTitle}</p>
          <p className="mt-1 text-sm" dir="auto">{tx(report.pregnancyNote)}</p>
        </div>
      )}

      <p className="flex gap-2 rounded-xl bg-surface p-3 text-sm font-medium">
        <AlertIcon className="mt-0.5 size-4 shrink-0" />
        {s.disclaimer}
      </p>
    </div>
  );
}

function AlertCard({ a, tx, detailed, pharmacist }: { a: SafetyAlert; tx: Tx; detailed: boolean; pharmacist: boolean }) {
  const { t } = useI18n();
  const s = t.safety;
  const st = STYLE[a.severity];
  const source = a.sources.length > 1 ? s.sources.both : a.sources[0] === "ai" ? s.sources.ai : s.sources.local;
  return (
    <li className={`relative overflow-hidden rounded-2xl border ${st.card}`}>
      <span className={`absolute inset-y-0 start-0 w-1.5 ${st.bar}`} aria-hidden="true" />
      <div className="space-y-2 p-4 ps-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${st.pill}`}>{s.severity[a.severity]}</span>
          <span className="text-xs font-medium text-muted">{s.types[a.type]}</span>
        </div>
        <p className="font-semibold">
          <bdi dir="ltr" className="latin">{a.drugs.join(" + ")}</bdi>
        </p>
        <div className="text-sm">
          <p className="font-medium text-muted">{s.whatHappens}</p>
          <p dir="auto">{tx(a.whatHappens)}</p>
        </div>
        <div className="text-sm">
          <p className="font-medium text-muted">{s.whatToDo}</p>
          <p dir="auto" className="font-medium">{tx(a.whatToDo)}</p>
        </div>
        {detailed && (
          <p className="text-xs text-muted">
            {source}
            {pharmacist && a.confidence && a.sources.includes("ai") && <> · {fmt(t.review.flag.ai, { c: t.review.confidence[a.confidence] })}</>}
          </p>
        )}
      </div>
    </li>
  );
}
