import type { CheckWarning, Medicine, Prescription } from "@/lib/schemas/extraction";
import { parseDuration, parseFrequency } from "@/lib/rx/shorthand";

/**
 * Logic for the "Check what we read" screen, kept separate from the UI
 * so it can be tested. Decides which fields get the amber ⚠ and keeps
 * track of what the person has checked.
 */

export type TopSection = "doctor" | "patient" | "clinical";
export type MedKey = keyof Omit<Medicine, "confidence" | "uncertain_fields" | "brand_mapping_certain">;

export type TopFieldDef = { path: string; section: TopSection; key: string; basic: boolean; words: string[] };
export type MedFieldDef = { key: MedKey; basic: boolean; words: string[] };

// basic = shown in patient view; the rest appear in pharmacist mode.
// words = how the AI might describe this field in "unreadable_fields".
export const TOP_FIELDS: TopFieldDef[] = [
  { path: "doctor.name", section: "doctor", key: "name", basic: true, words: ["doctor name", "doctor's name", "prescriber"] },
  { path: "doctor.qualifications", section: "doctor", key: "qualifications", basic: false, words: ["qualification"] },
  { path: "doctor.specialty", section: "doctor", key: "specialty", basic: false, words: ["specialty", "speciality"] },
  { path: "doctor.registration_no", section: "doctor", key: "registration_no", basic: false, words: ["pmdc", "registration"] },
  { path: "doctor.clinic_or_hospital", section: "doctor", key: "clinic_or_hospital", basic: true, words: ["clinic", "hospital"] },
  { path: "doctor.address", section: "doctor", key: "address", basic: false, words: ["doctor address", "clinic address"] },
  { path: "doctor.phone", section: "doctor", key: "phone", basic: true, words: ["doctor phone", "clinic phone"] },
  { path: "prescription_date", section: "patient", key: "prescription_date", basic: true, words: ["prescription date", "date of prescription"] },
  { path: "patient.name", section: "patient", key: "name", basic: true, words: ["patient name", "patient's name"] },
  { path: "patient.age", section: "patient", key: "age", basic: true, words: ["age"] },
  { path: "patient.sex", section: "patient", key: "sex", basic: true, words: ["sex", "gender"] },
  { path: "patient.weight", section: "patient", key: "weight", basic: true, words: ["weight"] },
  { path: "patient.address", section: "patient", key: "address", basic: false, words: ["patient address"] },
  { path: "patient.phone", section: "patient", key: "phone", basic: false, words: ["patient phone"] },
  { path: "patient.mr_or_file_no", section: "patient", key: "mr_or_file_no", basic: false, words: ["mr no", "mr number", "file no", "file number"] },
  { path: "clinical.diagnosis_or_complaints", section: "clinical", key: "diagnosis_or_complaints", basic: true, words: ["diagnosis", "complaint"] },
  { path: "clinical.vitals.blood_pressure", section: "clinical", key: "blood_pressure", basic: false, words: ["blood pressure", "bp"] },
  { path: "clinical.vitals.pulse", section: "clinical", key: "pulse", basic: false, words: ["pulse"] },
  { path: "clinical.vitals.temperature", section: "clinical", key: "temperature", basic: false, words: ["temperature", "temp"] },
  { path: "clinical.vitals.other", section: "clinical", key: "other", basic: false, words: ["vitals"] },
  { path: "clinical.allergies_mentioned", section: "clinical", key: "allergies_mentioned", basic: true, words: ["allerg"] },
  { path: "clinical.follow_up_date", section: "clinical", key: "follow_up_date", basic: true, words: ["follow", "next visit", "review date"] },
  { path: "clinical.other_advice", section: "clinical", key: "other_advice", basic: true, words: ["advice", "instruction"] },
];

export const MED_FIELDS: MedFieldDef[] = [
  { key: "brand_name", basic: true, words: ["name", "brand"] },
  { key: "generic_name", basic: true, words: ["generic", "salt"] },
  { key: "strength", basic: true, words: ["strength", "mg", "dose strength"] },
  { key: "dosage_form", basic: true, words: ["form"] },
  { key: "dose_per_time", basic: true, words: ["dose", "amount"] },
  { key: "frequency_text", basic: true, words: ["frequency", "how often", "times"] },
  { key: "times_per_day", basic: true, words: [] },
  { key: "schedule", basic: true, words: ["schedule", "timing"] },
  { key: "food_timing", basic: true, words: ["food", "meal"] },
  { key: "duration_text", basic: false, words: ["duration", "days", "how long"] },
  { key: "duration_days", basic: true, words: [] },
  { key: "total_quantity_needed", basic: true, words: ["quantity", "total"] },
  { key: "special_instructions", basic: true, words: ["instruction", "direction"] },
  { key: "route", basic: false, words: ["route"] },
  { key: "purpose_in_simple_words", basic: false, words: [] },
];

export type Flag = { reasons: ("low" | "unreadable" | "uncertain" | "check")[]; suggestion?: string };

export type ReviewMed = { id: string; data: Medicine; note: string };

export type ReviewState = {
  rx: Prescription; // top-level fields (its `medicines` is ignored; see `meds`)
  meds: ReviewMed[];
  flags: Record<string, Flag>; // decided once, when the screen opens
  confirmed: string[]; // fields the person edited or marked "Looks right"
  unreadable: { text: string; matched: boolean; done: boolean }[];
  generalNote: string;
};

let idCounter = 0;
const newId = () => `m${Date.now().toString(36)}${idCounter++}`;

export const medPath = (id: string, key: MedKey) => `${id}.${key}`;

function addFlag(flags: Record<string, Flag>, path: string, reason: Flag["reasons"][number], suggestion?: string) {
  const f = (flags[path] ??= { reasons: [] });
  if (!f.reasons.includes(reason)) f.reasons.push(reason);
  if (suggestion !== undefined) f.suggestion = suggestion;
}

/** "medicine 2 strength", "med #2 dose", "2nd medicine name" → medicine index 1 */
function medicineNumber(text: string): number | null {
  const m = text.match(/\b(?:medicine|med|drug|item|rx)\s*#?\s*(\d+)\b|\b(\d+)(?:st|nd|rd|th)\s+(?:medicine|med|drug)\b/i);
  const n = m ? Number(m[1] ?? m[2]) : NaN;
  return Number.isFinite(n) && n > 0 ? n - 1 : null;
}

/** Map the AI's own uncertain-field names ("strength", "dose") to our keys. */
function uncertainKey(name: string): MedKey | null {
  const n = name.toLowerCase();
  const direct = MED_FIELDS.find((f) => f.key === n);
  if (direct) return direct.key;
  if (/brand|name/.test(n)) return "brand_name";
  if (/strength/.test(n)) return "strength";
  if (/dose|amount/.test(n)) return "dose_per_time";
  if (/freq|times/.test(n)) return "frequency_text";
  if (/duration|days/.test(n)) return "duration_days";
  if (/quantity/.test(n)) return "total_quantity_needed";
  if (/food|meal/.test(n)) return "food_timing";
  if (/form/.test(n)) return "dosage_form";
  return null;
}

/** Build the starting state for the review screen from the AI result. */
export function initReview(rx: Prescription, checks: CheckWarning[]): ReviewState {
  const flags: Record<string, Flag> = {};
  const meds: ReviewMed[] = rx.medicines.map((data) => ({ id: newId(), data: { ...data, schedule: { ...data.schedule } }, note: "" }));

  // 1. Top fields the AI was not sure about (only if something was read).
  for (const f of TOP_FIELDS) {
    const field = getTop(rx, f.path);
    if (field.value !== null && field.confidence === "low") addFlag(flags, f.path, "low");
  }

  // 2. Medicine fields the AI listed as uncertain, or that our own check disagreed with.
  meds.forEach((med, i) => {
    for (const name of med.data.uncertain_fields) {
      const key = uncertainKey(name);
      if (key) addFlag(flags, medPath(med.id, key), "uncertain");
    }
    if (med.data.confidence === "low" && !med.data.brand_name && !med.data.generic_name) addFlag(flags, medPath(med.id, "brand_name"), "low");
    for (const c of checks.filter((c) => c.medicineIndex === i)) {
      addFlag(flags, medPath(med.id, c.field as MedKey), "check", c.expected);
    }
  });

  // 3. Things the AI said it couldn't read: attach to a field where we can tell which one.
  const unreadable = rx.unreadable_fields.map((text) => {
    const lower = text.toLowerCase();
    const n = medicineNumber(lower);
    if (n !== null && meds[n]) {
      const def = MED_FIELDS.find((f) => f.words.some((w) => lower.includes(w)));
      addFlag(flags, medPath(meds[n].id, def?.key ?? "brand_name"), "unreadable");
      return { text, matched: true, done: false };
    }
    const top = TOP_FIELDS.find((f) => f.words.some((w) => lower.includes(w)) && (f.section === "clinical" || lower.includes(f.section) || f.words.some((w) => w.includes(" ") && lower.includes(w))));
    if (top) {
      addFlag(flags, top.path, "unreadable");
      return { text, matched: true, done: false };
    }
    return { text, matched: false, done: false };
  });

  return { rx, meds, flags, confirmed: [], unreadable, generalNote: "" };
}

/* ---------------- reading and changing values ---------------- */

type FieldObj = { value: string | null; confidence: "high" | "medium" | "low" };

export function getTop(rx: Prescription, path: string): FieldObj {
  return path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], rx) as FieldObj;
}

export function setTop(rx: Prescription, path: string, value: string | null): Prescription {
  const keys = path.split(".");
  const clone = structuredClone(rx);
  let o = clone as unknown as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>;
  o[keys[keys.length - 1]] = { value: value?.trim() ? value : null, confidence: "high" }; // person checked it
  return clone;
}

/** Update one medicine field. Changing the written frequency/duration updates the numbers too. */
export function updateMed(med: Medicine, key: MedKey, value: unknown): Medicine {
  const m: Medicine = { ...med, schedule: { ...med.schedule }, [key]: value };
  if (key === "frequency_text") {
    const f = parseFrequency(value as string);
    if (f) {
      m.times_per_day = f.asNeeded ? null : f.timesPerDay;
      m.schedule = { ...f.schedule };
    }
  }
  if (key === "duration_text") {
    const d = parseDuration(value as string);
    if (d) m.duration_days = d.days;
  }
  return m;
}

export function blankMedicine(): Medicine {
  return {
    brand_name: null, generic_name: null, brand_mapping_certain: false, strength: null, dosage_form: null,
    dose_per_time: null, frequency_text: null, times_per_day: null, schedule: { morning: 0, afternoon: 0, evening: 0, night: 0 },
    route: "oral", food_timing: null, duration_days: null, duration_text: null, total_quantity_needed: null,
    special_instructions: null, purpose_in_simple_words: null, confidence: "high", uncertain_fields: [],
  };
}

export function newReviewMed(): ReviewMed {
  return { id: newId(), data: blankMedicine(), note: "" };
}

/* ---------------- what still needs attention ---------------- */

export function isVisible(path: string, pharmacist: boolean): boolean {
  if (pharmacist) return true;
  const top = TOP_FIELDS.find((f) => f.path === path);
  if (top) return top.basic;
  const key = path.split(".").slice(1).join(".") as MedKey;
  return MED_FIELDS.find((f) => f.key === key)?.basic ?? true;
}

/** Fields still marked ⚠ (visible in this mode, not yet checked), in screen order. */
export function attentionPaths(s: ReviewState, pharmacist: boolean): string[] {
  const order = [...TOP_FIELDS.map((f) => f.path), ...s.meds.flatMap((m) => MED_FIELDS.map((f) => medPath(m.id, f.key)))];
  return order.filter((p) => s.flags[p] && !s.confirmed.includes(p) && isVisible(p, pharmacist));
}

export function attentionCount(s: ReviewState, pharmacist: boolean): number {
  return attentionPaths(s, pharmacist).length + s.unreadable.filter((u) => !u.matched && !u.done).length;
}

/** The final, checked prescription to pass on to the summary. */
export function finalPrescription(s: ReviewState): Prescription {
  return {
    ...s.rx,
    medicines: s.meds
      .map((m) => m.data)
      .filter((d) => d.brand_name || d.generic_name),
  };
}
