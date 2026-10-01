"use client";

import { useI18n } from "@/components/I18nProvider";
import { fmt } from "@/lib/format";
import { fmtNode } from "@/lib/format-node";
import type { Medicine, Prescription } from "@/lib/schemas/extraction";
import type { SafetyAlert, SafetyReport, Severity } from "@/lib/schemas/safety";
import { displayName } from "@/lib/rx/drugs";
import { buildCare } from "@/lib/summary/care";
import { courseFor, todayISO } from "@/lib/summary/dates";
import { formatDate } from "@/lib/summary/format";
import { howToTake } from "@/lib/summary/how-to-take";
import { cardText, durationText, frequencyText, type ShareCtx } from "@/lib/summary/share-text";
import { SLOTS, buildTimetable } from "@/lib/summary/timetable";
import { InfoRow, SummaryCard } from "@/components/summary/SummaryCard";
import { NoPlateIcon, PlateIcon, SLOT_ICONS } from "@/components/summary/pictograms";
import { SafetyPanel } from "@/components/summary/SafetyPanel";
import { AlertIcon, PhoneIcon } from "@/components/icons";

const PILL: Record<Severity, string> = { major: "bg-red-600 text-white", moderate: "bg-orange-500 text-white", minor: "bg-yellow-300 text-yellow-950" };

/* 1. Safety alerts (only shown when something was found) */
export function SafetyAlertsCard({ ctx, stillFlagged, unreadable }: { ctx: ShareCtx; stillFlagged: number; unreadable: string[] }) {
  const { t } = useI18n();
  const alerts = (ctx.safety?.alerts ?? []).filter((a) => a.severity !== "minor");
  const poor = ctx.rx.overall_legibility === "poor";
  if (!alerts.length && !stillFlagged && !poor) return null;
  return (
    <SummaryCard id="safety" icon="🚨" title={t.summary.cards.safety} tone="danger" text={() => cardText.safety(ctx)}>
      <div className="space-y-3">
        {poor && <p className="rounded-xl border-2 border-red-400 bg-white p-3 font-semibold text-red-800">{t.review.poorWarning}</p>}
        {alerts.length > 0 && (
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start gap-2">
                <span className={`mt-0.5 rounded-full px-2 py-0.5 text-xs font-bold ${PILL[a.severity]}`}>{t.safety.severity[a.severity]}</span>
                <span className="min-w-0 flex-1">
                  <bdi dir="ltr" className="latin font-semibold">{a.drugs.join(" + ")}</bdi>
                  <span className="block text-sm" dir="auto">{a.whatHappens}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {stillFlagged > 0 && (
          <div className="rounded-xl bg-white p-3 text-sm">
            <p className="font-semibold text-amber-800">{fmt(t.summary.safetyCard.stillFlagged, { n: stillFlagged })}</p>
            {unreadable.length > 0 && (
              <>
                <p className="mt-1">{t.summary.safetyCard.unreadable}</p>
                <ul dir="ltr" className="latin list-disc ps-5">{unreadable.map((u) => <li key={u}>{u}</li>)}</ul>
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
  return (
    <SummaryCard id="doctor" icon="👨‍⚕️" title={t.summary.cards.doctor} text={() => cardText.doctor(ctx)}>
      <dl>
        <InfoRow label={f.name} ltr>{d.name.value ?? t.summary.med.notWritten}</InfoRow>
        <InfoRow label={f.qualifications} ltr>{d.qualifications.value}</InfoRow>
        <InfoRow label={f.specialty} ltr>{d.specialty.value}</InfoRow>
        <InfoRow label={f.clinic_or_hospital} ltr>{d.clinic_or_hospital.value}</InfoRow>
        <InfoRow label={f.address} ltr>{d.address.value}</InfoRow>
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
  const { t, locale } = useI18n();
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
        <InfoRow label={t.summary.info.date}>{date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? formatDate(date, locale) : date}</InfoRow>
      </dl>
    </SummaryCard>
  );
}

/* 4. Diagnosis and advice */
export function DiagnosisCard({ ctx }: { ctx: ShareCtx }) {
  const { t } = useI18n();
  const c = ctx.rx.clinical;
  return (
    <SummaryCard id="diagnosis" icon="🩺" title={t.summary.cards.diagnosis} text={() => cardText.diagnosis(ctx)}>
      <dl>
        <InfoRow label={t.review.fields.diagnosis_or_complaints}><span dir="auto">{c.diagnosis_or_complaints.value ?? t.summary.med.notWritten}</span></InfoRow>
        <InfoRow label={t.summary.info.tests} ltr>{c.tests_advised.length ? c.tests_advised.join(", ") : null}</InfoRow>
        <InfoRow label={t.summary.info.followUp}>{c.follow_up_date.value && <span dir="auto">{c.follow_up_date.value}</span>}</InfoRow>
        <InfoRow label={t.summary.info.advice}>{c.other_advice.value && <span dir="auto">{c.other_advice.value}</span>}</InfoRow>
      </dl>
      {ctx.generalNote && (
        <p className="mt-3 rounded-xl bg-sky-50 p-3 text-sm"><span className="font-semibold">{t.summary.info.pharmacistNote}: </span><span dir="auto">{ctx.generalNote}</span></p>
      )}
    </SummaryCard>
  );
}

/* 5. One card per medicine */
export function MedicineCard({ ctx, index, alerts }: { ctx: ShareCtx; index: number; alerts: SafetyAlert[] }) {
  const { t } = useI18n();
  const m: Medicine = ctx.rx.medicines[index];
  const s = t.summary.med;
  const { how, shake } = howToTake(m);
  const worst = alerts.find((a) => a.severity === "major") ?? alerts.find((a) => a.severity === "moderate");
  return (
    <SummaryCard id={`med-${index}`} icon="💊" title={`${index + 1}. ${displayName(m)}`} text={() => cardText.medicine(ctx, index)}>
      <div className="space-y-4">
        <div>
          <p className="text-lg font-bold"><bdi dir="ltr" className="latin">{[m.brand_name ?? m.generic_name, m.strength].filter(Boolean).join(" ")}</bdi></p>
          {m.brand_name && m.generic_name && <p className="text-sm text-muted"><bdi dir="ltr" className="latin">{m.generic_name}</bdi></p>}
          {m.purpose_in_simple_words && (
            <p className="mt-1"><span className="text-muted">{s.whatFor}: </span><span dir="auto" className="font-medium">{m.purpose_in_simple_words}</span></p>
          )}
        </div>

        {/* Times of day as pictures */}
        <div className="grid grid-cols-4 gap-2" role="list">
          {SLOTS.map((slot) => {
            const Icon = SLOT_ICONS[slot];
            const n = m.schedule[slot];
            return (
              <div key={slot} role="listitem" aria-label={`${t.review.med[slot]}: ${n || "–"}`}
                className={`flex flex-col items-center rounded-xl border py-2 text-center ${n ? "border-brand bg-brand/5 text-brand" : "border-line text-muted/50"}`}>
                <Icon className="size-7" />
                <span className="text-xs">{t.review.med[slot]}</span>
                <span className="latin text-lg font-bold">{n ? n : "–"}</span>
              </div>
            );
          })}
        </div>

        <dl className="divide-y divide-line/60">
          <InfoRow label={s.howMuch} ltr>{m.dose_per_time}</InfoRow>
          <InfoRow label={s.howOften}>{frequencyText(m, t)}</InfoRow>
          {m.food_timing && (
            <div className="flex items-center gap-2 py-1">
              {m.food_timing === "empty stomach" ? <NoPlateIcon className="size-6 text-muted" /> : <PlateIcon className="size-6 text-muted" />}
              <dt className="text-muted">{s.food}:</dt>
              <dd className="font-medium">{t.review.food[m.food_timing]}</dd>
            </div>
          )}
          <InfoRow label={s.howToTake}>{`${t.summary.howTo[how]}${shake ? `. ${t.summary.howTo.shake}` : ""}`}</InfoRow>
          <InfoRow label={s.howLong}>{durationText(m, t)}</InfoRow>
          <InfoRow label={s.total} ltr>{m.total_quantity_needed}</InfoRow>
          <InfoRow label={s.warnings}>{m.special_instructions && <span dir="auto">{m.special_instructions}</span>}</InfoRow>
        </dl>

        {ctx.notes[index] && (
          <p className="rounded-xl bg-sky-50 p-3 text-sm"><span className="font-semibold">{s.note}: </span><span dir="auto">{ctx.notes[index]}</span></p>
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
  const tt = buildTimetable(ctx.rx.medicines);
  return (
    <SummaryCard id="timetable" icon="🕒" title={t.summary.cards.timetable} text={() => cardText.timetable(ctx)}>
      <ol className="space-y-2">
        {SLOTS.map((slot) => {
          const Icon = SLOT_ICONS[slot];
          const items = tt.slots[slot];
          return (
            <li key={slot} className={`flex gap-3 rounded-xl p-3 ${items.length ? "bg-surface" : "opacity-60"}`}>
              <div className="flex w-20 shrink-0 flex-col items-center text-brand">
                <Icon className="size-8" />
                <span className="text-sm font-semibold">{t.review.med[slot]}</span>
              </div>
              <ul className="min-w-0 flex-1 space-y-1 self-center">
                {items.length === 0 && <li className="text-sm text-muted">{t.summary.timetable.empty}</li>}
                {items.map((x) => (
                  <li key={x.medIndex} className="flex flex-wrap items-center gap-x-2">
                    <bdi dir="ltr" className="latin font-semibold">{x.name}</bdi>
                    {x.amount && <bdi dir="ltr" className="latin text-sm">{x.amount}</bdi>}
                    {x.food && x.food !== "any" && <span className="flex items-center gap-1 text-xs text-muted"><PlateIcon className="size-4" />{t.review.food[x.food]}</span>}
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
    </SummaryCard>
  );
}

/* 7. Course calendar */
export function CalendarCard({ ctx, onStartChange }: { ctx: ShareCtx; onStartChange: (iso: string) => void }) {
  const { t, locale } = useI18n();
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
                    {co.status === "upcoming" ? fmtNode(c.upcoming, { date: formatDate(co.start, locale) })
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
                    <span>{formatDate(co.start, locale)}</span>
                    <span className="font-medium text-orange-700">{fmtNode(c.lastDay, { date: formatDate(co.end, locale) })}</span>
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
      <SafetyPanel report={ctx.safety} pending={pending} onRetry={onRetry} embedded />
    </SummaryCard>
  );
}

/* 9. General care */
export function CareCard({ ctx }: { ctx: ShareCtx }) {
  const { t } = useI18n();
  const care = buildCare(ctx.rx.medicines, ctx.safety);
  const s = t.summary.care;
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
                  <ul className="list-disc ps-5" dir="auto">{x.items.map((i) => <li key={i}>{i}</li>)}</ul>
                </li>
              ))}
            </ul>
          </div>
        )}
        {care.avoid.length > 0 && (
          <div>
            <h3 className="font-semibold">{s.avoid}</h3>
            <ul className="mt-1 list-disc space-y-1 ps-5" dir="auto">{care.avoid.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        )}
        <div>
          <h3 className="font-semibold">{s.storage}</h3>
          <ul className="mt-1 list-disc space-y-1 ps-5" dir="auto">{care.storage.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-900">
          <h3 className="font-semibold">{s.urgent}</h3>
          <ul className="mt-1 list-disc space-y-1 ps-5" dir="auto">{care.urgent.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      </div>
    </SummaryCard>
  );
}

export type { Prescription, SafetyReport };
