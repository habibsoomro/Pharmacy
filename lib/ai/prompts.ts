import brandData from "@/data/brand-generics.json";
import type { SummaryLang } from "@/lib/languages";
import type { InteractionRequest } from "@/lib/schemas/safety";
import type { TranslateRequest } from "@/lib/schemas/translate";

/**
 * The values filled into the prompt files in /prompts. Shared by the server
 * (normal website) and the single-page version inside Claude, so both ask the
 * AI exactly the same thing.
 */

/** Fill {{PLACEHOLDERS}} in a prompt. */
export function fillPrompt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : `{{${k}}}`));
}

const brandList = Object.entries(brandData.brands).map(([b, g]) => `${b} = ${g}`).join("; ");

export function extractVars(today: string, pageCount: number) {
  return { BRAND_LIST: brandList, TODAY: today, PAGE_COUNT: pageCount };
}

const or = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? "not written" : String(v));

export function interactionVars(req: InteractionRequest) {
  const medicines = req.medicines
    .map((m, i) =>
      `${i + 1}. ${or(m.name)} (generic: ${or(m.generic)}), strength ${or(m.strength)}, form ${or(m.form)}, route ${or(m.route)}, ` +
      `dose ${or(m.dose)}, frequency "${or(m.frequency)}" (${or(m.times_per_day)} times a day), duration ${m.duration_days ? `${m.duration_days} days` : "not written"}`,
    )
    .join("\n");
  return {
    AGE: or(req.patient.age), SEX: or(req.patient.sex), WEIGHT: or(req.patient.weight),
    DIAGNOSIS: or(req.diagnosis), ALLERGIES: or(req.allergies), MEDICINES: medicines,
  };
}

/** How each language is described to the AI. Edit here if a translation comes out in the wrong script or style. */
export const TRANSLATE_LANGUAGE: Record<Exclude<SummaryLang, "en">, { name: string; script: string }> = {
  ur: { name: "Urdu", script: "Write in Urdu script (Nastaliq/Arabic letters), as used in Pakistan." },
  sd: { name: "Sindhi", script: "Write in Sindhi Arabic script as used in Sindh, Pakistan, with the Sindhi letters (ڪ ڳ ڄ ٻ ڀ ٽ ڏ ڌ ڙ ڻ etc.)." },
  roman: {
    name: "Roman Urdu",
    script: "Write Urdu in English (Latin) letters, the way Pakistanis type Urdu on WhatsApp, for example \"Khana khane ke baad 1 goli lein.\" Do not use Urdu script.",
  },
  pa: { name: "Punjabi (Shahmukhi)", script: "Write Punjabi in Shahmukhi (Urdu-style Arabic) script, as used in Pakistani Punjab. Do NOT use Gurmukhi." },
  ps: { name: "Pashto", script: "Write in Pashto Arabic script as used in Khyber Pakhtunkhwa, Pakistan, with the Pashto letters (ټ ډ ړ ښ ږ ځ څ ڼ ګ)." },
  bal: { name: "Balochi", script: "Write in Balochi using the Arabic (Urdu-style) script as used in Balochistan, Pakistan." },
};

const TRANSLATE_STYLE: Record<TranslateRequest["level"], string> = {
  simple:
    "Use the simplest everyday words and very short sentences, as you would speak to an elderly person who cannot read well. Avoid medical terms; explain them in plain words instead.",
  detailed:
    "Use clear, natural language. You may keep an important medical term, with the English term in brackets after it the first time.",
  ui: "These are labels, headings and button texts from a pharmacy app. Use short, natural, everyday words.",
};

export function translateVars(req: TranslateRequest) {
  const lang = TRANSLATE_LANGUAGE[req.target as Exclude<SummaryLang, "en">];
  return {
    system: { LANGUAGE: lang.name, STYLE: TRANSLATE_STYLE[req.level], SCRIPT_RULE: `10. ${lang.script}` },
    user: { LANGUAGE: lang.name, COUNT: req.texts.length, TEXTS: JSON.stringify(req.texts.map((text, i) => ({ i, text })), null, 1) },
  };
}
