import type { Medicine } from "@/lib/schemas/extraction";
import { displayName } from "@/lib/rx/drugs";
import { parseDose, parseFrequency } from "@/lib/rx/shorthand";

export const SLOTS = ["morning", "afternoon", "evening", "night"] as const;
export type Slot = (typeof SLOTS)[number];
export type TimetableItem = { medIndex: number; name: string; strength: string | null; amount: string | null; food: Medicine["food_timing"] };

/** How much to take at one time: uses "2 tablets" from the prescription, or the number from a "1+0+2" pattern. */
function amountAt(med: Medicine, count: number): string | null {
  const dose = parseDose(med.dose_per_time);
  const pattern = parseFrequency(med.frequency_text);
  const uneven = pattern && pattern.unitsPerDoseFromPattern === null && pattern.timesPerDay && pattern.timesPerDay > 1;
  if (med.dose_per_time && !uneven) return med.dose_per_time;
  if (dose?.unit === "unit" || !med.dose_per_time) {
    const form = (med.dosage_form ?? "").toLowerCase();
    const word = form.startsWith("cap") ? (count === 1 ? "capsule" : "capsules") : form.startsWith("tab") || !form ? (count === 1 ? "tablet" : "tablets") : "";
    return word ? `${count} ${word}` : String(count);
  }
  return med.dose_per_time;
}

/** Morning / afternoon / evening / night lists, plus medicines taken only when needed. */
export function buildTimetable(meds: Medicine[]): { slots: Record<Slot, TimetableItem[]>; asNeeded: TimetableItem[]; unscheduled: TimetableItem[] } {
  const slots: Record<Slot, TimetableItem[]> = { morning: [], afternoon: [], evening: [], night: [] };
  const asNeeded: TimetableItem[] = [];
  const unscheduled: TimetableItem[] = [];
  meds.forEach((med, medIndex) => {
    const base = { medIndex, name: displayName(med), strength: med.strength, food: med.food_timing };
    const freq = parseFrequency(med.frequency_text);
    // "SOS", "PRN", "TDS SOS": only when needed, never at fixed times (even if a maximum per day is written).
    if (freq?.asNeeded) return asNeeded.push({ ...base, amount: med.dose_per_time });
    // If the times of day are empty, work them out from the written frequency ("1+0+1", "BD").
    const schedule = SLOTS.some((k) => med.schedule[k] > 0) || !freq ? med.schedule : freq.schedule;
    const total = SLOTS.reduce((s, k) => s + schedule[k], 0);
    if (total === 0) return unscheduled.push({ ...base, amount: med.dose_per_time });
    for (const slot of SLOTS) {
      const n = schedule[slot];
      if (n > 0) slots[slot].push({ ...base, amount: amountAt(med, n) });
    }
  });
  return { slots, asNeeded, unscheduled };
}
