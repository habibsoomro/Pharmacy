import brandData from "@/data/brand-generics.json";
import type { CheckWarning, Medicine, Prescription } from "@/lib/schemas/extraction";
import { parseDose, parseDuration, parseFrequency, totalFromSchedule, totalQuantity, type Dose } from "@/lib/rx/shorthand";

const BRANDS: Record<string, string> = Object.fromEntries(
  Object.entries(brandData.brands).map(([brand, generic]) => [brand.toLowerCase(), generic]),
);

/** "Tab. Panadol Extra 500mg" → "panadol extra" → generic, using the local list. */
export function lookupGeneric(brandName: string | null): string | null {
  if (!brandName) return null;
  const cleaned = brandName
    .toLowerCase()
    .replace(/^(tab|tabs|tablet|cap|caps|capsule|syp|syr|syrup|susp|inj|drops?|oint|cr|sachet)\.?\s+/, "")
    .replace(/\s+\d.*$/, "") // drop strength: "panadol 500mg" → "panadol"
    .replace(/[^a-z0-9\s/-]/g, "")
    .trim();
  if (BRANDS[cleaned]) return BRANDS[cleaned];
  // Longest known brand that the name starts with ("augmentin ds" → "augmentin").
  const match = Object.keys(BRANDS)
    .filter((b) => cleaned === b || cleaned.startsWith(b + " "))
    .sort((a, b) => b.length - a.length)[0];
  return match ? BRANDS[match] : null;
}

// Different names for the same medicine.
const SYNONYMS: [RegExp, string][] = [
  [/co-?amoxiclav/g, "amoxicillin clavulanate"],
  [/co-?trimoxazole/g, "sulfamethoxazole trimethoprim"],
  [/acetaminophen/g, "paracetamol"],
  [/albuterol/g, "salbutamol"],
  [/cephradine/g, "cefradine"],
  [/cephalexin/g, "cefalexin"],
  [/glyburide/g, "glibenclamide"],
  [/valproic|divalproex/g, "valproate"],
  [/scopolamine/g, "hyoscine"],
];

/** Do two generic names refer to the same salt(s)? Compares main words, ignores order/case. */
export function sameGeneric(a: string, b: string): boolean {
  const words = (s: string) =>
    new Set(
      SYNONYMS.reduce((acc, [re, to]) => acc.replace(re, to), s.toLowerCase().replace(/\(.*?\)/g, " "))
        .split(/[\s+,/&-]+|\band\b/)
        .map((w) => w.replace(/[^a-z]/g, ""))
        .filter((w) => w.length > 3 && !["acid", "sodium", "potassium", "hydrochloride", "hcl"].includes(w)),
    );
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return a.trim().toLowerCase() === b.trim().toLowerCase();
  // Every salt in the reference must appear in the AI's answer (handles spelling like cefradine/cephradine loosely).
  return [...B].every((w) => [...A].some((x) => x === w || x.startsWith(w.slice(0, 6)) || w.startsWith(x.slice(0, 6))));
}

function unitWord(dose: Dose, form: string | null, n: number): string {
  if (dose.unit === "ml") return "ml";
  if (dose.unit === "drop") return n === 1 ? "drop" : "drops";
  if (dose.unit === "puff") return n === 1 ? "puff" : "puffs";
  if (dose.unit === "sachet") return n === 1 ? "sachet" : "sachets";
  const f = (form ?? "").toLowerCase();
  if (f.startsWith("cap")) return n === 1 ? "capsule" : "capsules";
  if (f.startsWith("tab") || f === "") return n === 1 ? "tablet" : "tablets";
  return n === 1 ? "unit" : "units";
}

const firstNumber = (s: string | null) => {
  const m = s?.match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};

/**
 * Compare the AI's numbers with our own shorthand reading.
 * - If the AI left a number empty and we can work it out, we fill it in.
 * - If the AI and our check disagree, we keep the AI's value, mark the
 *   medicine as low confidence, and add a warning for the review screen.
 */
export function crossCheck(rx: Prescription): { prescription: Prescription; checks: CheckWarning[] } {
  const checks: CheckWarning[] = [];

  const medicines = rx.medicines.map((original, i): Medicine => {
    const m: Medicine = { ...original, schedule: { ...original.schedule }, uncertain_fields: [...original.uncertain_fields] };
    const flag = (field: CheckWarning["field"], aiValue: string | null, expected: string, message: string) => {
      checks.push({ medicineIndex: i, field, aiValue, expected, message });
      m.confidence = "low";
      if (!m.uncertain_fields.includes(field)) m.uncertain_fields.push(field);
    };

    // 1. How many times a day
    const freq = parseFrequency(m.frequency_text);
    if (freq && !freq.asNeeded) {
      if (m.times_per_day === null && freq.timesPerDay !== null) m.times_per_day = freq.timesPerDay;
      else if (freq.timesPerDay !== null && m.times_per_day !== freq.timesPerDay) {
        flag("times_per_day", String(m.times_per_day), String(freq.timesPerDay),
          `"${m.frequency_text}" usually means ${freq.timesPerDay} time(s) a day, but ${m.times_per_day} was read.`);
      }
      const empty = !m.schedule.morning && !m.schedule.afternoon && !m.schedule.evening && !m.schedule.night;
      if (empty) m.schedule = { ...freq.schedule };
    }

    // 2. How many days
    const dur = parseDuration(m.duration_text);
    if (dur?.days) {
      if (m.duration_days === null) m.duration_days = dur.days;
      else if (m.duration_days !== dur.days) {
        flag("duration_days", String(m.duration_days), String(dur.days),
          `"${m.duration_text}" usually means ${dur.days} days, but ${m.duration_days} was read.`);
      }
    }

    // 3. Total quantity
    let dose = parseDose(m.dose_per_time);
    if (!dose && freq?.unitsPerDoseFromPattern) dose = { amount: freq.unitsPerDoseFromPattern, unit: "unit" };
    const uneven = freq && !freq.asNeeded && freq.unitsPerDoseFromPattern === null && !m.dose_per_time;
    const expectedAmount = uneven
      ? totalFromSchedule(m.schedule, m.duration_days)
      : totalQuantity(dose, m.times_per_day, m.duration_days)?.amount ?? null;
    if (expectedAmount !== null && dose) {
      const expectedText = `${expectedAmount} ${unitWord(dose, m.dosage_form, expectedAmount)}`;
      const aiAmount = firstNumber(m.total_quantity_needed);
      if (m.total_quantity_needed === null) m.total_quantity_needed = expectedText;
      else if (aiAmount !== null && aiAmount !== expectedAmount) {
        flag("total_quantity_needed", m.total_quantity_needed, expectedText,
          `Dose × times a day × days gives ${expectedText}, but ${m.total_quantity_needed} was read.`);
      }
    }

    // 4. Brand → generic, using our local list
    const reference = lookupGeneric(m.brand_name);
    if (reference) {
      if (!m.generic_name) {
        m.generic_name = reference;
        checks.push({ medicineIndex: i, field: "generic_name", aiValue: null, expected: reference,
          message: `Generic name for "${m.brand_name}" was filled in from the pharmacy's brand list.` });
      } else if (!sameGeneric(m.generic_name, reference)) {
        flag("generic_name", m.generic_name, reference,
          `The pharmacy's brand list says "${m.brand_name}" is ${reference}, but "${m.generic_name}" was read.`);
      }
    }

    return m;
  });

  return { prescription: { ...rx, medicines }, checks };
}
