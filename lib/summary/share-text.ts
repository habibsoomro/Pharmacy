import type { Dictionary } from "@/lib/i18n";
import type { SummaryLang } from "@/lib/languages";
import type { Medicine, Prescription } from "@/lib/schemas/extraction";
import type { SafetyReport } from "@/lib/schemas/safety";
import type { HideableCard } from "@/lib/settings";
import { fmt } from "@/lib/format";
import { displayName } from "@/lib/rx/drugs";
import { parseFrequency } from "@/lib/rx/shorthand";
import { buildCare } from "@/lib/summary/care";
import { courseFor } from "@/lib/summary/dates";
import { formatDate } from "@/lib/summary/format";
import { howToTake } from "@/lib/summary/how-to-take";
import { SLOTS, buildTimetable } from "@/lib/summary/timetable";

/** Returns the translation of a text from the prescription or safety check (or the text itself). */
export type Tx = <T extends string | null | undefined>(s: T) => T;
export const noTranslation: Tx = (s) => s;

/**
 * Everything the summary cards need. Also used to make plain-text versions
 * of each card for Copy, WhatsApp and Read Aloud.
 * Medicine names stay in English, as pharmacies stock them that way.
 */
export type ShareCtx = {
  t: Dictionary;
  lang: SummaryLang;
  rx: Prescription;
  safety: SafetyReport | null;
  start: string;
  notes: string[];
  generalNote: string;
  tx: Tx;
  /** Reading level "Detailed": more medical detail. */
  detailed: boolean;
  /** Pharmacist view: generic names, strengths, quantities and confidence. */
  pharmacist: boolean;
};

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

/** "Twice a day (1+0+1)": in Detailed mode the prescription's own shorthand is added. */
export function frequencyWithShorthand(m: Medicine, ctx: Pick<ShareCtx, "t" | "detailed" | "pharmacist">): string {
  const plain = frequencyText(m, ctx.t);
  const written = m.frequency_text;
  return (ctx.detailed || ctx.pharmacist) && written && written !== plain ? `${plain} (${written})` : plain;
}

export const cardText = {
  safety({ t, safety, tx }: ShareCtx) {
    const alerts = safety?.alerts ?? [];
    if (!alerts.length) return join([`🚨 ${t.summary.cards.safety}`, t.summary.safetyCard.none]);
    return join([`🚨 ${t.summary.cards.safety}`, ...alerts.map((a) => `• [${t.safety.severity[a.severity]}] ${a.drugs.join(" + ")}: ${tx(a.whatHappens)} ${tx(a.whatToDo)}`)]);
  },
  doctor({ t, rx, detailed }: ShareCtx) {
    const d = rx.doctor;
    const f = t.review.fields;
    return join([`👨‍⚕️ ${t.summary.cards.doctor}`, line(f.name, d.name.value), detailed && line(f.qualifications, d.qualifications.value), line(f.specialty, d.specialty.value),
      line(f.clinic_or_hospital, d.clinic_or_hospital.value), line(f.phone, d.phone.value)]);
  },
  patient({ t, rx, lang }: ShareCtx) {
    const p = rx.patient;
    const f = t.review.fields;
    return join([`🧑 ${t.summary.cards.patient}`, line(f.name, p.name.value), line(f.age, p.age.value), line(f.sex, p.sex.value), line(f.weight, p.weight.value),
      line(t.summary.info.date, rx.prescription_date.value && /^\d{4}-\d{2}-\d{2}$/.test(rx.prescription_date.value) ? formatDate(rx.prescription_date.value, lang) : rx.prescription_date.value)]);
  },
  diagnosis({ t, rx, generalNote, tx }: ShareCtx) {
    const c = rx.clinical;
    return join([`🩺 ${t.summary.cards.diagnosis}`, line(t.review.fields.diagnosis_or_complaints, tx(c.diagnosis_or_complaints.value)),
      c.tests_advised.length ? line(t.summary.info.tests, c.tests_advised.join(", ")) : null, line(t.summary.info.followUp, tx(c.follow_up_date.value)),
      line(t.summary.info.advice, tx(c.other_advice.value)), line(t.summary.info.pharmacistNote, tx(generalNote) || null)]);
  },
  medicine(ctx: ShareCtx, i: number) {
    const { t, rx, notes, tx } = ctx;
    const m = rx.medicines[i];
    const s = t.summary.med;
    const { how, shake } = howToTake(m);
    const name = [displayName(m), m.strength].filter(Boolean).join(" ");
    return join([`💊 ${i + 1}. ${name}${m.generic_name && m.brand_name ? ` (${m.generic_name})` : ""}`,
      line(s.whatFor, tx(m.purpose_in_simple_words)), line(s.howMuch, m.dose_per_time), line(s.howOften, frequencyWithShorthand(m, ctx)),
      line(s.food, m.food_timing ? t.review.food[m.food_timing] : null), line(s.howToTake, `${t.summary.howTo[how]}${shake ? `. ${t.summary.howTo.shake}` : ""}`),
      line(s.howLong, durationText(m, t)), line(s.total, m.total_quantity_needed), line(s.warnings, tx(m.special_instructions)), line(s.note, tx(notes[i]) || null)]);
  },
  timetable({ t, rx }: ShareCtx) {
    const tt = buildTimetable(rx.medicines);
    const L = t.review.med;
    return join([`🕒 ${t.summary.cards.timetable}`,
      ...SLOTS.filter((sl) => tt.slots[sl].length).map((sl) => `${L[sl]}: ${tt.slots[sl].map((x) => `${x.name}${x.amount ? ` (${x.amount})` : ""}`).join(", ")}`),
      tt.asNeeded.length ? `${t.summary.timetable.asNeeded}: ${tt.asNeeded.map((x) => x.name).join(", ")}` : null]);
  },
  calendar({ t, rx, start, lang }: ShareCtx) {
    const c = t.summary.calendar;
    return join([`📅 ${t.summary.cards.calendar}`, `${c.startDate}: ${formatDate(start, lang)}`,
      ...rx.medicines.map((m) => {
        const co = courseFor(m, start);
        const status = co.kind === "fixed" ? fmt(c.lastDay, { date: formatDate(co.end, lang) }) : c[co.kind];
        return `• ${displayName(m)}: ${status}`;
      })]);
  },
  care({ t, rx, safety, tx }: ShareCtx) {
    const care = buildCare(rx.medicines, safety);
    const s = t.summary.care;
    return join([`ℹ️ ${t.summary.cards.care}`,
      care.sideEffects.length ? `${s.sideEffects}:\n${care.sideEffects.map((x) => `• ${x.name}: ${x.items.map(tx).join("; ")}`).join("\n")}` : null,
      care.avoid.length ? `${s.avoid}:\n${care.avoid.map((x) => `• ${x.drugs.join(" + ")}: ${tx(x.text)}`).join("\n")}` : null,
      `${s.urgent}\n${care.urgent.map((x) => `• ${tx(x)}`).join("\n")}`]);
  },
  dispensing({ t, rx }: ShareCtx) {
    const d = t.summary.dispensing;
    return join([`📋 ${d.title}`, ...rx.medicines.map((m, i) =>
      `${i + 1}. ${[m.brand_name, m.generic_name && `(${m.generic_name})`, m.strength, m.dosage_form].filter(Boolean).join(" ")}: ${m.total_quantity_needed ?? d.qtyUnknown}`)]);
  },
};

/** The whole summary as one message. Cards the person turned off are left out (safety alerts never are). */
export function fullText(ctx: ShareCtx, pharmacyName: string, shown: (card: HideableCard) => boolean = () => true): string {
  const parts = [
    `${ctx.t.summary.title} (${pharmacyName})`,
    cardText.safety(ctx),
    shown("patient") && cardText.patient(ctx),
    shown("doctor") && cardText.doctor(ctx),
    shown("diagnosis") && cardText.diagnosis(ctx),
    ...(shown("medicines") ? ctx.rx.medicines.map((_, i) => cardText.medicine(ctx, i)) : []),
    shown("timetable") && cardText.timetable(ctx),
    shown("calendar") && cardText.calendar(ctx),
    shown("care") && cardText.care(ctx),
    ctx.pharmacist && shown("dispensing") && cardText.dispensing(ctx),
    `⚠️ ${ctx.t.common.disclaimer}`,
  ];
  return parts.filter(Boolean).join("\n\n");
}

/** All prescription and safety texts in the summary that need translating (not the app's own labels). */
export function summaryTexts(ctx: Pick<ShareCtx, "rx" | "safety" | "notes" | "generalNote">): (string | null)[] {
  const { rx, safety } = ctx;
  const care = buildCare(rx.medicines, safety);
  return [
    rx.clinical.diagnosis_or_complaints.value, rx.clinical.follow_up_date.value, rx.clinical.other_advice.value,
    ...rx.unreadable_fields,
    ...rx.medicines.flatMap((m) => [m.purpose_in_simple_words, m.special_instructions]),
    ...(safety?.alerts ?? []).flatMap((a) => [a.whatHappens, a.whatToDo]),
    ...(safety?.ageWarnings ?? []), safety?.pregnancyNote ?? null,
    ...care.sideEffects.flatMap((s) => s.items), ...care.storage, ...care.urgent,
    ...ctx.notes, ctx.generalNote,
  ];
}
