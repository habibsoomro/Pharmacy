import type { Medicine } from "@/lib/schemas/extraction";
import { parseDuration, parseFrequency } from "@/lib/rx/shorthand";

/** Dates are handled as "YYYY-MM-DD" text in local time, so time zones never shift a day. */
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const toDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const toISO = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => toISO(new Date(toDate(iso).getTime() + n * 86_400_000));
export const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86_400_000);

/** "2026-09-28", "28/09/2026", "28-9-26", "28.09.2026" → "2026-09-28". Pakistani dates are day/month/year. */
export function parseRxDate(text: string | null): string | null {
  if (!text) return null;
  const t = text.trim();
  let y: number, m: number, d: number;
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const dmy = t.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (dmy) [d, m, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3])];
  else return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCDate() === d ? toISO(date) : null;
}

/** When the course starts: the prescription date if it's sensible (not in the future, within 60 days), otherwise today. */
export function defaultStartDate(prescriptionDate: string | null, today = todayISO()): string {
  const p = parseRxDate(prescriptionDate);
  if (p && daysBetween(p, today) >= 0 && daysBetween(p, today) <= 60) return p;
  return today;
}

export type Course =
  | { kind: "fixed"; start: string; end: string; totalDays: number; dayNumber: number; status: "upcoming" | "active" | "lastDay" | "done"; progress: number }
  | { kind: "ongoing" | "asNeeded" | "unknown" | "single" };

/** The course for one medicine: start, last day, which day we're on today, and how far along (0 to 1). */
export function courseFor(med: Pick<Medicine, "duration_days" | "duration_text" | "frequency_text">, start: string, today = todayISO()): Course {
  const freq = parseFrequency(med.frequency_text);
  if (freq?.singleDose) return { kind: "single" };
  const days = med.duration_days ?? parseDuration(med.duration_text)?.days ?? null;
  if (!days) {
    if (parseDuration(med.duration_text)?.ongoing) return { kind: "ongoing" };
    if (freq?.asNeeded) return { kind: "asNeeded" };
    return { kind: "unknown" };
  }
  const end = addDays(start, days - 1);
  const dayNumber = daysBetween(start, today) + 1;
  const status = dayNumber < 1 ? "upcoming" : dayNumber > days ? "done" : dayNumber === days ? "lastDay" : "active";
  const progress = Math.min(1, Math.max(0, dayNumber / days));
  return { kind: "fixed", start, end, totalDays: days, dayNumber, status, progress: status === "upcoming" ? 0 : progress };
}
