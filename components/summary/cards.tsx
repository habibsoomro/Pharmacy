"use client";

import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { useSettings } from "@/components/SettingsProvider";
import { fmt } from "@/lib/format";
import { fmtNode } from "@/lib/format-node";
import type { Confidence, Medicine, Prescription } from "@/lib/schemas/extraction";
import type { SafetyAlert, SafetyReport, Severity } from "@/lib/schemas/safety";
import { displayName } from "@/lib/rx/drugs";
import { buildCare } from "@/lib/summary/care";
import { courseFor, todayISO } from "@/lib/summary/dates";
import { formatDate } from "@/lib/summary/format";
import { howToTake } from "@/lib/summary/how-to-take";
import { cardText, durationText, frequencyWithShorthand, type ShareCtx } from "@/lib/summary/share-text";
import { SLOTS, buildTimetable } from "@/lib/summary/timetable";
import { InfoRow, SummaryCard } from "@/components/summary/SummaryCard";
import { NoPlateIcon, PlateIcon, SLOT_ICONS } from "@/components/summary/pictograms";
import { SafetyPanel } from "@/components/summary/SafetyPanel";
import { RemindersDialog } from "@/components/summary/Reminders";
import { AlertIcon, BellIcon, PhoneIcon } from "@/components/icons";

const PILL: Record<Severity, string> = { major: "bg-red-600 text-white", moderate: "bg-orange-500 text-white", minor: "bg-yellow-300 text-yellow-950" };
const CONFIDENCE_PILL: Record<Confidence, string> = {
  high: "border-emerald-300 bg-emerald-50 text-emerald-800",
  medium: "border-amber-300 bg-amber-50 text-amber-900",
  low: "border-red-300 bg-red-50 text-red-800",
};

function ConfidencePill({ c }: { c: Confidence }) {
  const { t } = useI18n();
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${CONFIDENCE_PILL[c]}`}>{fmt(t.review.flag.ai, { c: t.review.confidence[c] })}</span>;
}

/* 1. Safety alerts (only shown when something was found) */
export function SafetyAlertsCard({ ctx, stillFlagged, unreadable }: { ctx: ShareCtx; stillFlagged: number; unreadable: string[] }) {
  const { t } = useI18n();
  const { tx } = ctx;
  const alerts = (ctx.safety?.alerts ?? []).filter((a) => a.severity !== "minor");
  const poor = ctx.rx.overall_legibility === "poor";
  if (!alerts.length && !stillFlagged && !poor) return null;
  return (
    <SummaryCard id="safety" icon="🚨" title={t.summary.cards.safety} tone="danger" text={() => cardText.safety(ctx)}>
      <div className="space-y-3">
        {poor && <p className="rounded-xl border-2 border-red-400 bg-card p-3 font-semibold text-red-800">{t.review.poorWarning}</p>}
        {alerts.length > 0 && (
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start gap-2">
                <span className={`mt-0.5 rounded-full px-2 py-0.5 text-xs font-bold ${PILL[a.severity]}`}>{t.safety.severity[a.severity]}</span>
                <span className="min-w-0 flex-1">
                  <bdi dir="ltr" className="latin font-semibold">{a.drugs.join(" + ")}</bdi>
                  <span className="block text-sm" dir="auto">{tx(a.whatHappens)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {stillFlagged > 0 && (
          <div className="rounded-xl bg-card p-3 text-sm">
            <p className="font-semibold text-amber-800">{fmt(t.summary.safetyCard.stillFlagged, { n: stillFlagged })}</p>
            {unreadable.length > 0 && (
              <>
                <p className="mt-1">{t.summary.safetyCard.unreadable}</p>
                <ul dir="auto" className="list-disc ps-5">{unreadable.map((u) => <li key={u}>{tx(u)}</li>)}</ul>
              </>
            )}
          </div>
        )}
        {alerts.length > 0 && <a href="#card-interactions" className="no-print inline-block text-sm text-brand underline underline-offset-4">{t.summary.safetyCard.seeDetails}</a>}
      </div>
    </SummaryCard>
  );
}

/* 2. Doctor */
export function DoctorCard({ ctx }: { ctx: ShareCtx }) {
  const { t } = useI18n();
  const d = ctx.rx.doctor;
  const f = t.review.fields;
  const phone = d.phone.value;
  const more = ctx.detailed || ctx.pharmacist;
  return (
    <SummaryCard id="doctor" icon="👨‍⚕️" title={t.summary.cards.doctor} text={() => cardText.doctor(ctx)}>
      <dl>
        <InfoRow label={f.name} ltr>{d.name.value ?? t.summary.med.notWritten}</InfoRow>
        {more && <InfoRow label={f.qualifications} ltr>{d.qualifications.value}</InfoRow>}
        <InfoRow label={f.specialty} ltr>{d.specialty.value}</InfoRow>
        {ctx.pharmacist && <InfoRow label={f.registration_no} ltr>{d.registration_no.value}</InfoRow>}
        <InfoRow label={f.clinic_or_hospital} ltr>{d.clinic_or_hospital.value}</InfoRow>
        {more && <InfoRow label={f.address} ltr>{d.address.value}</InfoRow>}
      </dl>
      {phone && (
        <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-brand px-4 font-semibold text-brand">
          <PhoneIcon className="size-5" />
          {t.summary.info.call}
          <bdi dir="ltr" className="latin font-normal">{phone}</bdi>
        </a>
      )}
    </SummaryCard>
  );
}

/* 3. Patient */
export function PatientCard({ ctx }: { ctx: ShareCtx }) {
  const { t, lang } = useI18n();
  const p = ctx.rx.patient;
  const f = t.review.fields;
  const date = ctx.rx.prescription_date.value;
  return (
    <SummaryCard id="patient" icon="🧑" title={t.summary.cards.patient} text={() => cardText.patient(ctx)}>
      <dl className="grid gap-x-6 sm:grid-cols-2">
        <InfoRow label={f.name} ltr>{p.name.value ?? t.summary.med.notWritten}</InfoRow>
        <InfoRow label={f.age} ltr>{p.age.value}</InfoRow>
        <InfoRow label={f.sex} ltr>{p.sex.value}</InfoRow>
        <InfoRow label={f.weight} ltr>{p.weight.value}</InfoRow>
        <InfoRow label={t.summary.info.date}>{date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? formatDate(date, lang) : date}</InfoRow>
        {ctx.pharmacist && <InfoRow label={f.mr_or_file_no} ltr>{p.mr_or_file_no.value}</InfoRow>}
      </dl>
    </SummaryCard>
  );
}

/* 4. Diagnosis and advice */
export function DiagnosisCard({ ctx }: { ctx: ShareCtx }) {
  const { t } = useI18n();
  const { tx } = ctx;
  const c = ctx.rx.clinical;
  const f = t.review.fields;
  const more = ctx.detailed || ctx.pharmacist;
  return (
    <SummaryCard id="diagnosis" icon="🩺" title={t.summary.cards.diagnosis} text={() => cardText.diagnosis(ctx)}>
      <dl>
        <InfoRow label={f.diagnosis_or_complaints}><span dir="auto">{tx(c.diagnosis_or_complaints.value) ?? t.summary.med.notWritten}</span></InfoRow>
        {more && (
          <>
            <InfoRow label={f.blood_pressure} ltr>{c.vitals.blood_pressure.value}</InfoRow>
            <InfoRow label={f.pulse} ltr>{c.vitals.pulse.value}</InfoRow>
            <InfoRow label={f.temperature} ltr>{c.vitals.temperature.value}</InfoRow>
            <InfoRow label={f.other} ltr>{c.vitals.other.value}</InfoRow>
            <InfoRow label={f.allergies_mentioned} ltr>{c.allergies_mentioned.value}</InfoRow>
          </>
        )}
        <InfoRow label={t.summary.info.tests} ltr>{c.tests_advised.length ? c.tests_advised.join(", ") : null}</InfoRow>
        <InfoRow label={t.summary.info.followUp}>{c.follow_up_date.value && <span dir="auto">{tx(c.follow_up_date.value)}</span>}</InfoRow>
        <InfoRow label={t.summary.info.advice}>{c.other_advice.value && <span dir="auto">{tx(c.other_advice.value)}</span>}</InfoRow>
      </dl>
      {ctx.generalNote && (
        <p className="mt-3 rounded-xl bg-sky-50 p-3 text-sm"><span className="font-semibold">{t.summary.info.pharmacistNote}: </span><span dir="auto">{tx(ctx.generalNote)}</span></p>
      )}
    </SummaryCard>
  );
}

/* 5. One card per medicine */
export function MedicineCard({ ctx, index, alerts }: { ctx: ShareCtx; index: number; alerts: SafetyAlert[] }) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const pictures = settings.pictures;
  const { tx } = ctx;
  const m: Medicine = ctx.rx.medicines[index];
  const s = t.summary.med;
  const { how, shake } = howToTake(m);
  const worst = alerts.find((a) => a.severity === "major") ?? alerts.find((a) => a.severity === "moderate");
  const more = ctx.detailed || ctx.pharmacist;
  const mappingUnsure = ctx.pharmacist && m.brand_name && m.generic_name && !m.brand_mapping_certain;
  return (
    <SummaryCard id={`med-${index}`} icon="💊" title={`${index + 1}. ${displayName(m)}`} text={() => cardText.medicine(ctx, index)}>
      <div className="space-y-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-bold"><bdi dir="ltr" className="latin">{[m.brand_name ?? m.generic_name, m.strength].filter(Boolean).join(" ")}</bdi></p>
            {ctx.pharmacist && <ConfidencePill c={m.confidence} />}
          </div>
          {m.brand_name && m.generic_name && (
            <p className={ctx.pharmacist ? "font-semibold" : "text-sm text-muted"}>
              <bdi dir="ltr" className="latin">{ctx.pharmacist ? [m.generic_name, m.strength, m.dosage_form].filter(Boolean).join(" · ") : m.generic_name}</bdi>
            </p>
          )}
          {mappingUnsure && <p className="mt-1 text-xs font-semibold text-amber-800">⚠ {t.summary.dispensing.mappingUnsure}</p>}
          {m.purpose_in_simple_words && (
            <p className="mt-1"><span className="text-muted">{s.whatFor}: </span><span dir="auto" className="font-medium">{tx(m.purpose_in_simple_words)}</span></p>
          )}
        </div>

        {/* Times of day (as pictures in picture mode) */}
        <div className="grid grid-cols-4 gap-2" role="list">
          {SLOTS.map((slot) => {
            const Icon = SLOT_ICONS[slot];
            const n = m.schedule[slot];
            return (
              <div key={slot} role="listitem" aria-label={`${t.review.med[slot]}: ${n || "–"}`}
                className={`flex flex-col items-center rounded-xl border py-2 text-center ${n ? "border-brand bg-brand/5 text-brand" : "border-line text-muted/50"}`}>
                {pictures && <Icon className="size-7" />}
                <span className="text-xs">{t.review.med[slot]}</span>
                <span className="latin text-lg font-bold">{n ? n : "–"}</span>
              </div>
            );
          })}
        </div>

        <dl className="divide-y divide-line/60">
          <InfoRow label={s.howMuch} ltr>{m.dose_per_time}</InfoRow>
          <InfoRow label={s.howOften}>{frequencyWithShorthand(m, ctx)}</InfoRow>
          {m.food_timing && (
            <div className="flex items-center gap-2 py-1">
              {pictures && (m.food_timing === "empty stomach" ? <NoPlateIcon className="size-6 text-muted" /> : <PlateIcon className="size-6 text-muted" />)}
              <dt className="text-muted">{s.food}:</dt>
              <dd className="font-medium">{t.review.food[m.food_timing]}</dd>
            </div>
          )}
          <InfoRow label={s.howToTake}>{`${t.summary.howTo[how]}${shake ? `. ${t.summary.howTo.shake}` : ""}`}</InfoRow>
          {more && <InfoRow label={t.review.med.route} ltr>{m.route}</InfoRow>}
          <InfoRow label={s.howLong}>
            {durationText(m, t)}
            {more && m.duration_text && <bdi dir="ltr" className="latin text-muted"> ({m.duration_text})</bdi>}
          </InfoRow>
          <InfoRow label={ctx.pharmacist ? t.summary.dispensing.qty : s.total} ltr>{m.total_quantity_needed}</InfoRow>
          <InfoRow label={s.warnings}>{m.special_instructions && <span dir="auto">{tx(m.special_instructions)}</span>}</InfoRow>
        </dl>

        {ctx.notes[index] && (
          <p className="rounded-xl bg-sky-50 p-3 text-sm"><span className="font-semibold">{s.note}: </span><span dir="auto">{tx(ctx.notes[index])}</span></p>
        )}
        {worst && (
          <a href="#card-interactions" className={`flex items-center gap-2 rounded-xl p-3 text-sm font-semibold ${worst.severity === "major" ? "bg-red-50 text-red-800" : "bg-orange-50 text-orange-900"}`}>
            <AlertIcon className="size-5 shrink-0" />
            {s.alerts} ({alerts.length})
          </a>
        )}
      </div>
    </SummaryCard>
  );
}

/* 6. Daily timetable */
export function TimetableCard({ ctx }: { ctx: ShareCtx }) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const [remindersOpen, setRemindersOpen] = useState(false);
  const tt = buildTimetable(ctx.rx.medicines);
  return (
    <SummaryCard id="timetable" icon="🕒" title={t.summary.cards.timetable} text={() => cardText.timetable(ctx)}>
      <ol className="space-y-2">
        {SLOTS.map((slot) => {
          const Icon = SLOT_ICONS[slot];
          const items = tt.slots[slot];
          return (
            <li key={slot} className={`flex gap-3 rounded-xl p-3 ${items.length ? "bg-surface" : "opacity-60"}`}>
              <div className="flex w-20 shrink-0 flex-col items-center justify-center text-brand">
                {settings.pictures && <Icon className="size-8" />}
                <span className="text-sm font-semibold">{t.review.med[slot]}</span>
              </div>
              <ul className="min-w-0 flex-1 space-y-1 self-center">
                {items.length === 0 && <li className="text-sm text-muted">{t.summary.timetable.empty}</li>}
                {items.map((x) => (
                  <li key={x.medIndex} className="flex flex-wrap items-center gap-x-2">
                    <bdi dir="ltr" className="latin font-semibold">{x.name}</bdi>
                    {x.amount && <bdi dir="ltr" className="latin text-sm">{x.amount}</bdi>}
                    {x.food && x.food !== "any" && (
                      <span className="flex items-center gap-1 text-xs text-muted">{settings.pictures && <PlateIcon className="size-4" />}{t.review.food[x.food]}</span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
      {(tt.asNeeded.length > 0 || tt.unscheduled.length > 0) && (
        <dl className="mt-3 text-sm">
          <InfoRow label={t.summary.timetable.asNeeded} ltr>{tt.asNeeded.length ? tt.asNeeded.map((x) => `${x.name}${x.amount ? ` (${x.amount})` : ""}`).join(", ") : null}</InfoRow>
          <InfoRow label={t.summary.timetable.unscheduled} ltr>{tt.unscheduled.length ? tt.unscheduled.map((x) => x.name).join(", ") : null}</InfoRow>
        </dl>
      )}
      <button type="button" onClick={() => setRemindersOpen(true)}
        className="no-print mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-brand font-semibold text-brand">
        <BellIcon className="size-5" />
        {t.summary.reminders.button}
      </button>
      {remindersOpen && <RemindersDialog ctx={ctx} onClose={() => setRemindersOpen(false)} />}
    </SummaryCard>
  );
}

/* 7. Course calendar */
export function CalendarCard({ ctx, onStartChange }: { ctx: ShareCtx; onStartChange: (iso: string) => void }) {
  const { t, lang } = useI18n();
  const c = t.summary.calendar;
  const today = todayISO();
  return (
    <SummaryCard id="calendar" icon="📅" title={t.summary.cards.calendar} text={() => cardText.calendar(ctx)}>
      <label className="mb-4 block">
        <span className="text-sm font-medium text-muted">{c.startDate}</span>
        <input type="date" dir="ltr" value={ctx.start} max={today} onChange={(e) => e.target.value && onStartChange(e.target.value)}
          className="latin mt-1 block rounded-lg border border-line bg-card px-3 py-2 text-base" />
        <span className="no-print mt-1 block text-xs text-muted">{c.startHint}</span>
      </label>
      <ul className="space-y-4">
        {ctx.rx.medicines.map((m, i) => {
          const co = courseFor(m, ctx.start, today);
          return (
            <li key={i}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <bdi dir="ltr" className="latin font-semibold">{displayName(m)}</bdi>
                {co.kind === "fixed" ? (
                  <span className="text-sm text-muted">
                    {co.status === "upcoming" ? fmtNode(c.upcoming, { date: formatDate(co.start, lang) })
                      : co.status === "done" ? c.done
                      : co.status === "lastDay" ? <span className="font-semibold text-orange-700">{c.lastDayToday}</span>
                      : fmtNode(c.dayOf, { n: co.dayNumber, total: co.totalDays })}
                  </span>
                ) : (
                  <span className="text-sm text-muted">{c[co.kind]}</span>
                )}
              </div>
              {co.kind === "fixed" && (
                <>
                  {/* dir="ltr" so the bar fills from the start date (left) to the last day (right) */}
                  <div dir="ltr" className="relative mt-1.5 h-3 overflow-hidden rounded-full bg-surface" role="progressbar"
                    aria-valuemin={0} aria-valuemax={co.totalDays} aria-valuenow={Math.max(0, Math.min(co.totalDays, co.dayNumber))}>
                    <div className={`h-full rounded-full ${co.status === "done" ? "bg-emerald-600" : "bg-brand"}`} style={{ width: `${co.progress * 100}%` }} />
                    <span className="absolute inset-y-0 right-0 w-1 bg-orange-500" aria-hidden="true" />
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-muted">
                    <span>{formatDate(co.start, lang)}</span>
                    <span className="font-medium text-orange-700">{fmtNode(c.lastDay, { date: formatDate(co.end, lang) })}</span>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </SummaryCard>
  );
}

/* 8. Interactions in detail */
export function InteractionsCard({ ctx, pending, onRetry }: { ctx: ShareCtx; pending: boolean; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <SummaryCard id="interactions" icon="⚠️" title={t.summary.cards.interactions} text={() => cardText.safety(ctx)}>
      <SafetyPanel report={ctx.safety} pending={pending} onRetry={onRetry} embedded tx={ctx.tx} detailed={ctx.detailed} pharmacist={ctx.pharmacist} />
    </SummaryCard>
  );
}

/* 9. General care */
export function CareCard({ ctx }: { ctx: ShareCtx }) {
  const { t } = useI18n();
  const { tx } = ctx;
  const care = buildCare(ctx.rx.medicines, ctx.safety);
  const s = t.summary.care;
  // Simple reading level: the two most important side effects per medicine; Detailed: all of them.
  const perMed = ctx.detailed || ctx.pharmacist ? 4 : 2;
  return (
    <SummaryCard id="care" icon="ℹ️" title={t.summary.cards.care} text={() => cardText.care(ctx)}>
      <div className="space-y-4 text-sm">
        {care.sideEffects.length > 0 && (
          <div>
            <h3 className="font-semibold">{s.sideEffects}</h3>
            <p className="text-muted">{s.sideEffectsHint}</p>
            <ul className="mt-2 space-y-2">
              {care.sideEffects.map((x) => (
                <li key={x.name}>
                  <bdi dir="ltr" className="latin font-semibold">{x.name}</bdi>
                  <ul className="list-disc ps-5" dir="auto">{x.items.slice(0, perMed).map((i) => <li key={i}>{tx(i)}</li>)}</ul>
                </li>
              ))}
            </ul>
          </div>
        )}
        {care.avoid.length > 0 && (
          <div>
            <h3 className="font-semibold">{s.avoid}</h3>
            <ul className="mt-1 list-disc space-y-1 ps-5">
              {care.avoid.map((x) => (
                <li key={x.drugs.join("+") + x.text}><bdi dir="ltr" className="latin font-semibold">{x.drugs.join(" + ")}</bdi>: <span dir="auto">{tx(x.text)}</span></li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <h3 className="font-semibold">{s.storage}</h3>
          <ul className="mt-1 list-disc space-y-1 ps-5" dir="auto">{care.storage.map((x) => <li key={x}>{tx(x)}</li>)}</ul>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-900">
          <h3 className="font-semibold">{s.urgent}</h3>
          <ul className="mt-1 list-disc space-y-1 ps-5" dir="auto">{care.urgent.map((x) => <li key={x}>{tx(x)}</li>)}</ul>
        </div>
      </div>
    </SummaryCard>
  );
}

/* 10. Dispensing list (pharmacist view only) */
export function DispensingCard({ ctx }: { ctx: ShareCtx }) {
  const { t } = useI18n();
  const d = t.summary.dispensing;
  return (
    <SummaryCard id="dispensing" icon="📋" title={d.title} text={() => cardText.dispensing(ctx)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-start text-muted">
              <th className="py-2 pe-2 text-start font-medium">{d.medicine}</th>
              <th className="py-2 pe-2 text-start font-medium">{d.qty}</th>
              <th className="py-2 text-start font-medium">{d.confidence}</th>
            </tr>
          </thead>
          <tbody>
            {ctx.rx.medicines.map((m, i) => (
              <tr key={i} className="border-b border-line/60 align-top">
                <td className="py-2 pe-2">
                  <bdi dir="ltr" className="latin block font-semibold">{i + 1}. {[m.brand_name ?? m.generic_name, m.strength].filter(Boolean).join(" ")}</bdi>
                  {m.brand_name && m.generic_name && <bdi dir="ltr" className="latin block text-muted">{m.generic_name}</bdi>}
                  {m.dosage_form && <bdi dir="ltr" className="latin block text-xs text-muted">{m.dosage_form}</bdi>}
                </td>
                <td className="py-2 pe-2">
                  {m.total_quantity_needed ? <bdi dir="ltr" className="latin font-semibold">{m.total_quantity_needed}</bdi> : <span className="text-muted">{d.qtyUnknown}</span>}
                </td>
                <td className="py-2"><ConfidencePill c={m.confidence} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SummaryCard>
  );
}

export type { Prescription, SafetyReport };
