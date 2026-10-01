import type { Field, Medicine } from "@/lib/schemas/extraction";
import { normalize, parseDose, parseFrequency } from "@/lib/rx/shorthand";

/** Age in years from "45 years", "6 months", "10 days", "2.5 yrs", "45", "۴۵ سال". Null if unclear. */
export function parseAgeYears(age: Field | string | null | undefined): number | null {
  const raw = typeof age === "object" && age !== null ? age.value : age;
  if (!raw) return null;
  const t = normalize(raw);
  const m = t.match(/(\d+(?:\.\d+)?)\s*(years?|yrs?|y\b|سال|saal|months?|mths?|mo\b|m\b|ماہ|مہینے|days?|d\b|دن|weeks?|wks?)?/);
  if (!m) return null;
  const n = Number(m[1]);
  const u = m[2] ?? "";
  if (/^(month|mth|mo|m$|ماہ|مہینے)/.test(u)) return n / 12;
  if (/^(week|wk)/.test(u)) return n / 52;
  if (/^(day|d$|دن)/.test(u)) return n / 365;
  return n > 0 && n < 130 ? n : null;
}

/** Weight in kg from "18 kg", "18kg", "40 lbs". */
export function parseWeightKg(weight: Field | string | null | undefined): number | null {
  const raw = typeof weight === "object" && weight !== null ? weight.value : weight;
  if (!raw) return null;
  const m = normalize(raw).match(/(\d+(?:\.\d+)?)\s*(kg|kgs|kilo|lb|lbs|pounds?)?/);
  if (!m) return null;
  const n = Number(m[1]);
  return /^(lb|pound)/.test(m[2] ?? "") ? Math.round((n / 2.2046) * 10) / 10 : n;
}

/** "500 mg" → {mg: 500}; "1 g" → {mg: 1000}; "250 mg/5 ml" → {mg: 250, perMl: 5}. Combination strengths → null. */
export function parseStrength(strength: string | null): { mg: number; perMl?: number } | null {
  if (!strength) return null;
  const t = normalize(strength).replace(/,/g, "");
  if (/\d\s*\/\s*\d+(\.\d+)?\s*mg/.test(t) || /\+/.test(t)) return null; // e.g. "500/125 mg"
  const m = t.match(/(\d+(?:\.\d+)?)\s*(mg|g|gm|mcg|µg|ug)\b(?:\s*\/\s*(\d+(?:\.\d+)?)?\s*ml)?/);
  if (!m) return null;
  let mg = Number(m[1]);
  if (m[2] === "g" || m[2] === "gm") mg *= 1000;
  if (["mcg", "µg", "ug"].includes(m[2])) mg /= 1000;
  if (t.includes("ml")) return { mg, perMl: m[3] ? Number(m[3]) : 1 };
  return { mg };
}

/** mg in one dose, or null if it can't be worked out safely. */
export function mgPerDose(med: Pick<Medicine, "strength" | "dose_per_time" | "frequency_text">): number | null {
  const s = parseStrength(med.strength);
  if (!s) return null;
  const dose = parseDose(med.dose_per_time);
  if (s.perMl) {
    return dose?.unit === "ml" ? (s.mg / s.perMl) * dose.amount : null;
  }
  if (dose && dose.unit !== "unit") return null;
  const units = dose?.amount ?? parseFrequency(med.frequency_text)?.unitsPerDoseFromPattern ?? null;
  return units === null ? null : s.mg * units;
}

/** mg per day, using the schedule when the doses differ by time of day. */
export function mgPerDay(med: Pick<Medicine, "strength" | "dose_per_time" | "frequency_text" | "times_per_day" | "schedule">): number | null {
  const perDose = mgPerDose(med);
  if (perDose !== null && med.times_per_day) return perDose * med.times_per_day;
  const s = parseStrength(med.strength);
  const total = med.schedule.morning + med.schedule.afternoon + med.schedule.evening + med.schedule.night;
  if (s && !s.perMl && !med.dose_per_time && total > 0) return s.mg * total;
  return null;
}
