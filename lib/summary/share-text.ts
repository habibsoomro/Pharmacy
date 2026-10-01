import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locales";
import type { Medicine, Prescription } from "@/lib/schemas/extraction";
import type { SafetyReport } from "@/lib/schemas/safety";
import { fmt } from "@/lib/format";
import { displayName } from "@/lib/rx/drugs";
import { parseFrequency } from "@/lib/rx/shorthand";
import { buildCare } from "@/lib/summary/care";
import { courseFor } from "@/lib/summary/dates";
import { formatDate } from "@/lib/summary/format";
import { howToTake } from "@/lib/summary/how-to-take";
import { SLOTS, buildTimetable } from "@/lib/summary/timetable";

/**
 * Plain-text versions of each card, for Copy and WhatsApp.
 * Medicine names stay in English, as pharmacies stock them that way.
 */
export type ShareCtx = { t: Dictionary; locale: Locale; rx: Prescription; safety: SafetyReport | null; start: string; notes: string[]; generalNote: string };

const line = (label: string, value: string | null | undefined) => (value ? `${label}: ${value}` : null);
const join = (lines: (string | null | undefined | false)[]) => lines.filter(Boolean).join("\n");

export function frequencyText(m: Medicine, t: Dictionary): string {
  const s = t.summary.med;
  if (parseFrequency(m.frequency_text)?.asNeeded) return s.asNeeded;
  if (m.times_per_day === 1) return s.once;
  if (m.times_per_day) return fmt(s.perDay, { n: m.times_per_day });
  return m.frequency_text ?? s.notWritten;
}

export function durationText(m: Medicine, t: Dictionary): string {
  const c = courseFor(m, "2000-01-01", "2000-01-01");
  if (c.kind === "fixed") return fmt(t.summary.med.days, { n: c.totalDays });
  if (c.kind === "ongoing") return t.summary.med.ongoing;
  if (c.kind === "asNeeded") return t.summary.med.asNeeded;
  return t.summary.med.notWritten;
}

export const cardText = {
  safety({ t, safety }: ShareCtx) {
    const alerts = safety?.alerts ?? [];
    if (!alerts.length) return join([`🚨 ${t.summary.cards.safety}`, t.summary.safetyCard.none]);
    return join([`🚨 ${t.summary.cards.safety}`, ...alerts.map((a) => `• [${t.safety.severity[a.severity]}] ${a.drugs.join(" + ")}: ${a.whatHappens} ${a.whatToDo}`)]);
  },
  doctor({ t, rx }: ShareCtx) {
    const d = rx.doctor;
    const f = t.review.fields;
    return join([`👨‍⚕️ ${t.summary.cards.doctor}`, line(f.name, d.name.value), line(f.qualifications, d.qualifications.value), line(f.specialty, d.specialty.value),
      line(f.clinic_or_hospital, d.clinic_or_hospital.value), line(f.phone, d.phone.value)]);
  },
  patient({ t, rx, locale }: ShareCtx) {
    const p = rx.patient;
    const f = t.review.fields;
    return join([`🧑 ${t.summary.cards.patient}`, line(f.name, p.name.value), line(f.age, p.age.value), line(f.sex, p.sex.value), line(f.weight, p.weight.value),
      line(t.summary.info.date, rx.prescription_date.value && /^\d{4}-\d{2}-\d{2}$/.test(rx.prescription_date.value) ? formatDate(rx.prescription_date.value, locale) : rx.prescription_date.value)]);
  },
  diagnosis({ t, rx, generalNote }: ShareCtx) {
    const c = rx.clinical;
    return join([`🩺 ${t.summary.cards.diagnosis}`, line(t.review.fields.diagnosis_or_complaints, c.diagnosis_or_complaints.value),
      c.tests_advised.length ? line(t.summary.info.tests, c.tests_advised.join(", ")) : null, line(t.summary.info.followUp, c.follow_up_date.value),
      line(t.summary.info.advice, c.other_advice.value), line(t.summary.info.pharmacistNote, generalNote || null)]);
  },
  medicine(ctx: ShareCtx, i: number) {
    const { t, rx, notes } = ctx;
    const m = rx.medicines[i];
    const s = t.summary.med;
    const { how, shake } = howToTake(m);
    const name = [displayName(m), m.strength].filter(Boolean).join(" ");
    return join([`💊 ${i + 1}. ${name}${m.generic_name && m.brand_name ? ` (${m.generic_name})` : ""}`,
      line(s.whatFor, m.purpose_in_simple_words), line(s.howMuch, m.dose_per_time), line(s.howOften, frequencyText(m, t)),
      line(s.food, m.food_timing ? t.review.food[m.food_timing] : null), line(s.howToTake, `${t.summary.howTo[how]}${shake ? `. ${t.summary.howTo.shake}` : ""}`),
      line(s.howLong, durationText(m, t)), line(s.total, m.total_quantity_needed), line(s.warnings, m.special_instructions), line(s.note, notes[i] || null)]);
  },
  timetable({ t, rx }: ShareCtx) {
    const tt = buildTimetable(rx.medicines);
    const L = t.review.med;
    return join([`🕒 ${t.summary.cards.timetable}`,
      ...SLOTS.filter((sl) => tt.slots[sl].length).map((sl) => `${L[sl]}: ${tt.slots[sl].map((x) => `${x.name}${x.amount ? ` (${x.amount})` : ""}`).join(", ")}`),
      tt.asNeeded.length ? `${t.summary.timetable.asNeeded}: ${tt.asNeeded.map((x) => x.name).join(", ")}` : null]);
  },
  calendar({ t, rx, start, locale }: ShareCtx) {
    const c = t.summary.calendar;
    return join([`📅 ${t.summary.cards.calendar}`, `${c.startDate}: ${formatDate(start, locale)}`,
      ...rx.medicines.map((m) => {
        const co = courseFor(m, start);
        const status = co.kind === "fixed" ? fmt(c.lastDay, { date: formatDate(co.end, locale) }) : c[co.kind];
        return `• ${displayName(m)}: ${status}`;
      })]);
  },
  care({ t, rx, safety }: ShareCtx) {
    const care = buildCare(rx.medicines, safety);
    const s = t.summary.care;
    return join([`ℹ️ ${t.summary.cards.care}`,
      care.sideEffects.length ? `${s.sideEffects}:\n${care.sideEffects.map((x) => `• ${x.name}: ${x.items.join("; ")}`).join("\n")}` : null,
      care.avoid.length ? `${s.avoid}:\n${care.avoid.map((x) => `• ${x}`).join("\n")}` : null,
      `${s.urgent}\n${care.urgent.map((x) => `• ${x}`).join("\n")}`]);
  },
};

/** The whole summary as one message. */
export function fullText(ctx: ShareCtx, pharmacyName: string): string {
  const parts = [
    `${ctx.t.summary.title} (${pharmacyName})`,
    cardText.safety(ctx), cardText.patient(ctx), cardText.doctor(ctx), cardText.diagnosis(ctx),
    ...ctx.rx.medicines.map((_, i) => cardText.medicine(ctx, i)),
    cardText.timetable(ctx), cardText.calendar(ctx), cardText.care(ctx),
    `⚠️ ${ctx.t.common.disclaimer}`,
  ];
  return parts.join("\n\n");
}
