"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/components/I18nProvider";
import { fmt } from "@/lib/format";
import { fmtNode } from "@/lib/format-node";
import type { CheckWarning, Confidence, Field, Prescription } from "@/lib/schemas/extraction";
import { AlertIcon } from "@/components/icons";

/**
 * TEMPORARY (Stage 3): a read-only view of what the AI read.
 * Stage 4 replaces this with the full review-and-edit screen.
 */
export function ExtractionPreview({ rx, checks }: { rx: Prescription; checks: CheckWarning[] }) {
  const { t } = useI18n();
  const p = t.scan.preview;

  return (
    <section className="space-y-4" aria-labelledby="preview-title">
      <h2 id="preview-title" className="text-xl font-bold text-brand">{p.title}</h2>

      {rx.overall_legibility === "poor" && (
        <p className="flex gap-2 rounded-xl border-2 border-red-300 bg-red-50 p-4 font-semibold text-red-800" role="alert">
          <AlertIcon className="mt-1 size-5 shrink-0" />
          {p.poorWarning}
        </p>
      )}
      <p className="text-sm text-muted">{p.legibility[rx.overall_legibility]}</p>

      <Box>
        <Row label={p.doctor} field={rx.doctor.name} />
        <Row label={p.patient} field={rx.patient.name} />
        <Row label={p.date} field={rx.prescription_date} />
        <Row label={p.diagnosis} field={rx.clinical.diagnosis_or_complaints} />
      </Box>

      <h3 className="pt-2 font-semibold">{p.medicines} ({rx.medicines.length})</h3>
      <ol className="space-y-3">
        {rx.medicines.map((m, i) => (
          <li key={i} className={`rounded-xl border bg-card p-4 ${m.confidence === "low" ? "border-amber-400" : "border-line"}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="latin font-semibold">
                <bdi dir="ltr">{[m.brand_name ?? m.generic_name ?? p.notReadable, m.strength].filter(Boolean).join(" ")}</bdi>
              </p>
              <ConfidenceBadge c={m.confidence} />
            </div>
            {m.generic_name && m.brand_name && <p className="latin text-sm text-muted"><bdi dir="ltr">{m.generic_name}</bdi></p>}
            <p className="mt-1 text-sm">
              {[
                m.dose_per_time && <bdi key="d" dir="ltr" className="latin">{m.dose_per_time}</bdi>,
                m.times_per_day === 1 ? p.once : m.times_per_day ? fmtNode(p.perDay, { n: m.times_per_day }) : /sos|prn/i.test(m.frequency_text ?? "") ? p.asNeeded : null,
                m.duration_days ? fmtNode(p.days, { n: m.duration_days }) : null,
                m.total_quantity_needed ? fmtNode(p.total, { q: m.total_quantity_needed }) : null,
              ]
                .filter(Boolean)
                .map((part, k) => (
                  <span key={k}>
                    {k > 0 && " · "}
                    {part}
                  </span>
                ))}
            </p>
          </li>
        ))}
      </ol>

      {(rx.unreadable_fields.length > 0 || checks.length > 0) && (
        <Box warn>
          {rx.unreadable_fields.length > 0 && (
            <>
              <p className="font-semibold">{p.unreadable}</p>
              <ul dir="ltr" className="latin list-disc ps-5 text-sm">
                {rx.unreadable_fields.map((f) => <li key={f}>{f}</li>)}
              </ul>
            </>
          )}
          {checks.length > 0 && (
            <>
              <p className="mt-2 font-semibold">{p.checks}</p>
              <ul dir="ltr" className="latin list-disc ps-5 text-sm">
                {checks.map((c, k) => <li key={k}>{c.message}</li>)}
              </ul>
            </>
          )}
        </Box>
      )}

      <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">{p.nextStage}</p>
    </section>
  );
}

function Box({ children, warn }: { children: ReactNode; warn?: boolean }) {
  return <div className={`space-y-1 rounded-xl border p-4 ${warn ? "border-amber-300 bg-amber-50 text-amber-950" : "border-line bg-card"}`}>{children}</div>;
}

function Row({ label, field }: { label: string; field: Field }) {
  const { t } = useI18n();
  return (
    <p className="flex flex-wrap gap-x-2">
      <span className="text-muted">{label}:</span>
      <span dir="auto" className={field.value ? "font-medium" : "text-muted italic"}>{field.value ?? t.scan.preview.notReadable}</span>
      {field.value && field.confidence === "low" && <span className="text-amber-700">⚠</span>}
    </p>
  );
}

function ConfidenceBadge({ c }: { c: Confidence }) {
  const { t } = useI18n();
  const style = c === "high" ? "bg-emerald-100 text-emerald-800" : c === "medium" ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-900";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}>{c === "low" && "⚠ "}{t.scan.preview.confidence[c]}</span>;
}
