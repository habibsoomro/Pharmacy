/**
 * Understands common Pakistani prescription shorthand, WITHOUT using AI.
 * Used to double-check (and fill gaps in) what the AI read.
 *
 * Examples:
 *   parseFrequency("1+0+1")  → 2 times a day (morning + night)
 *   parseFrequency("TDS")    → 3 times a day
 *   parseDuration("x 1/52")  → 7 days
 *   parseDose("½ tab")       → 0.5 tablet
 *   totalQuantity(...)       → how many tablets / ml for the whole course
 */

export type Schedule = { morning: number; afternoon: number; evening: number; night: number };
export const EMPTY_SCHEDULE: Schedule = { morning: 0, afternoon: 0, evening: 0, night: 0 };

export type Frequency = {
  timesPerDay: number | null; // null when "as needed" or not understood
  schedule: Schedule; // number of units at each time (0 = not taken)
  asNeeded: boolean; // SOS / PRN
  singleDose: boolean; // STAT
  unitsPerDoseFromPattern: number | null; // e.g. "2+0+2" → 2
};

const URDU_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Turn Urdu/Arabic digits and ½ ¼ ¾ into normal text, lower-case, tidy spaces. */
export function normalize(text: string): string {
  return text
    .replace(/[۰-۹]/g, (d) => String(URDU_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/½/g, "0.5")
    .replace(/¼/g, "0.25")
    .replace(/¾/g, "0.75")
    .replace(/(^|[^\d/])1\/2(?![\d/])/g, "$10.5") // "1/2 tab" → 0.5 (but not "1/2/2026" or "1/52")
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Read "1+0+1", "1-0-1", "0+0+1", "1+1+1+1", "0.5+0+0.5" patterns. */
function parsePattern(t: string): Frequency | null {
  const m = t.match(/(?:^|[^\d.])(\d+(?:\.\d+)?)\s*[+\-]\s*(\d+(?:\.\d+)?)\s*[+\-]\s*(\d+(?:\.\d+)?)(?:\s*[+\-]\s*(\d+(?:\.\d+)?))?(?![\d/])/);
  if (!m) return null;
  const slots = [m[1], m[2], m[3], m[4]].filter((s) => s !== undefined).map(Number);
  if (slots.some((n) => n > 10)) return null; // not a dose pattern (e.g. a date)

  // 3 slots = morning + afternoon + night (Pakistani convention); 4 slots adds evening.
  const schedule: Schedule =
    slots.length === 3
      ? { morning: slots[0], afternoon: slots[1], evening: 0, night: slots[2] }
      : { morning: slots[0], afternoon: slots[1], evening: slots[2], night: slots[3] };
  const nonZero = slots.filter((n) => n > 0);
  const same = nonZero.length > 0 && nonZero.every((n) => n === nonZero[0]);
  return {
    timesPerDay: nonZero.length || null,
    schedule,
    asNeeded: false,
    singleDose: false,
    unitsPerDoseFromPattern: same ? nonZero[0] : null,
  };
}

const ABBREVIATIONS: { re: RegExp; times: number; schedule: Schedule }[] = [
  { re: /\b(qid|qds|4 ?times|four times|6 ?hourly|q6h|every 6 hours)\b/, times: 4, schedule: { morning: 1, afternoon: 1, evening: 1, night: 1 } },
  { re: /\b(tds|tid|t\.d\.s|t\.i\.d|3 ?times|thrice|three times|8 ?hourly|q8h|every 8 hours)\b/, times: 3, schedule: { morning: 1, afternoon: 1, evening: 0, night: 1 } },
  { re: /\b(bd|bid|b\.d|b\.i\.d|2 ?times|twice|two times|12 ?hourly|q12h|every 12 hours)\b/, times: 2, schedule: { morning: 1, afternoon: 0, evening: 0, night: 1 } },
  { re: /\b(hs|h\.s|at bedtime|bed ?time|at night)\b/, times: 1, schedule: { morning: 0, afternoon: 0, evening: 0, night: 1 } },
  { re: /\b(od|o\.d|qd|once daily|once a day|1 ?time|daily|24 ?hourly|q24h)\b/, times: 1, schedule: { morning: 1, afternoon: 0, evening: 0, night: 0 } },
];

// Urdu / Roman Urdu words for times of day and frequency.
const URDU_WORDS: { re: RegExp; times: number; schedule: Schedule }[] = [
  { re: /(دن میں تین بار|تین وقت|teen waqt|din mein teen)/, times: 3, schedule: { morning: 1, afternoon: 1, evening: 0, night: 1 } },
  { re: /(دن میں دو بار|دو وقت|subah sham|صبح شام|do waqt)/, times: 2, schedule: { morning: 1, afternoon: 0, evening: 0, night: 1 } },
  { re: /(رات کو|سوتے وقت|raat ko|sote waqt)/, times: 1, schedule: { morning: 0, afternoon: 0, evening: 0, night: 1 } },
  { re: /(دن میں ایک بار|ایک وقت|ek waqt|roz ek)/, times: 1, schedule: { morning: 1, afternoon: 0, evening: 0, night: 0 } },
];

export function parseFrequency(text: string | null | undefined): Frequency | null {
  if (!text) return null;
  const t = normalize(text);

  const pattern = parsePattern(t);
  if (pattern) return pattern;

  const asNeeded = /\b(sos|s\.o\.s|prn|p\.r\.n|as needed|when needed|if needed|if required)\b|ضرورت/.test(t);
  const singleDose = /\b(stat|immediately|single dose|once only)\b/.test(t);

  for (const a of [...ABBREVIATIONS, ...URDU_WORDS]) {
    if (a.re.test(t)) {
      return { timesPerDay: asNeeded ? null : a.times, schedule: { ...a.schedule }, asNeeded, singleDose: false, unitsPerDoseFromPattern: null };
    }
  }
  if (singleDose) return { timesPerDay: 1, schedule: { ...EMPTY_SCHEDULE }, asNeeded: false, singleDose: true, unitsPerDoseFromPattern: null };
  if (asNeeded) return { timesPerDay: null, schedule: { ...EMPTY_SCHEDULE }, asNeeded: true, singleDose: false, unitsPerDoseFromPattern: null };
  return null;
}

export type Duration = { days: number | null; ongoing: boolean };

/** "x 5 days", "5/7", "1/52", "2/52", "1/12", "3 weeks", "1 month", "10d", "5 دن". */
export function parseDuration(text: string | null | undefined): Duration | null {
  if (!text) return null;
  const t = normalize(text);

  if (/\b(cont(inue)?|long ?term|lifelong|regular|till next visit|until review)\b|جاری|مسلسل/.test(t)) {
    return { days: null, ongoing: true };
  }

  // Medical fraction style: N/7 = days, N/52 = weeks, N/12 = months.
  const frac = t.match(/(\d+(?:\.\d+)?)\s*\/\s*(7|52|12)(?!\d)/);
  if (frac) {
    const n = Number(frac[1]);
    const days = frac[2] === "7" ? n : frac[2] === "52" ? n * 7 : n * 30;
    return { days: Math.round(days), ongoing: false };
  }

  const unit = t.match(/(\d+(?:\.\d+)?)\s*(days?|d\b|dys?|weeks?|wks?|w\b|months?|mths?|mo\b|دن|ہفتے|ہفتہ|ہفتوں|مہینے|مہینہ|ماہ|din|hafte|hafta|mahine|mahina)/);
  if (unit) {
    const n = Number(unit[1]);
    const u = unit[2];
    const days = /^(w|wk|week|ہفت|haft)/.test(u) ? n * 7 : /^(mo|mth|month|مہین|ماہ|mahin)/.test(u) ? n * 30 : n;
    return { days: Math.round(days), ongoing: false };
  }

  if (/\b(a|one) week\b/.test(t)) return { days: 7, ongoing: false };
  if (/\b(a|one) month\b/.test(t)) return { days: 30, ongoing: false };
  return null;
}

export type Dose = { amount: number; unit: "unit" | "ml" | "drop" | "puff" | "sachet" | "application" };

/** "1 tablet", "½ tab", "2 caps", "5 ml", "1 tsp", "2 TSF", "2 drops", "1 puff". */
export function parseDose(text: string | null | undefined): Dose | null {
  if (!text) return null;
  const t = normalize(text);
  const m = t.match(/(\d+(?:\.\d+)?)\s*(ml|cc|tsp|tsf|teaspoons?|tbsp|tablespoons?|drops?|gtts?|puffs?|sachets?|tabs?|tablets?|caps?|capsules?|pills?)?/);
  if (!m) return null;
  const n = Number(m[1]);
  const u = m[2] ?? "";
  if (/^(ml|cc)$/.test(u)) return { amount: n, unit: "ml" };
  if (/^(tsp|tsf|teaspoon)/.test(u)) return { amount: n * 5, unit: "ml" };
  if (/^(tbsp|tablespoon)/.test(u)) return { amount: n * 15, unit: "ml" };
  if (/^(drop|gtt)/.test(u)) return { amount: n, unit: "drop" };
  if (/^puff/.test(u)) return { amount: n, unit: "puff" };
  if (/^sachet/.test(u)) return { amount: n, unit: "sachet" };
  return { amount: n, unit: "unit" };
}

/**
 * Total needed for the whole course, e.g. 1 tab × 2/day × 5 days = 10 tablets.
 * Returns null if anything needed is missing (we never guess).
 * Half tablets are rounded UP to whole tablets.
 */
export function totalQuantity(dose: Dose | null, timesPerDay: number | null, days: number | null): { amount: number; unit: Dose["unit"] } | null {
  if (!dose || !timesPerDay || !days) return null;
  const raw = dose.amount * timesPerDay * days;
  const amount = dose.unit === "unit" || dose.unit === "sachet" ? Math.ceil(raw - 1e-9) : Math.round(raw * 10) / 10;
  return { amount, unit: dose.unit };
}

/** Total units from a schedule (handles "1+0+2" where doses differ by time). */
export function totalFromSchedule(schedule: Schedule, days: number | null): number | null {
  if (!days) return null;
  const perDay = schedule.morning + schedule.afternoon + schedule.evening + schedule.night;
  return perDay > 0 ? Math.ceil(perDay * days - 1e-9) : null;
}
