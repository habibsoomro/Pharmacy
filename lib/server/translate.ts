import "server-only";
import { AI_MAX_TOKENS } from "@/config/ai";
import { askForJson } from "@/lib/server/ask-json";
import { loadPrompt } from "@/lib/server/prompts";
import type { SummaryLang } from "@/lib/languages";
import { translationsFor, type TranslateRequest } from "@/lib/schemas/translate";

/** How each language is described to the AI. Edit here if a translation comes out in the wrong script or style. */
const LANGUAGE: Record<Exclude<SummaryLang, "en">, { name: string; script: string }> = {
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

const STYLE: Record<TranslateRequest["level"], string> = {
  simple:
    "Use the simplest everyday words and very short sentences, as you would speak to an elderly person who cannot read well. Avoid medical terms; explain them in plain words instead.",
  detailed:
    "Use clear, natural language. You may keep an important medical term, with the English term in brackets after it the first time.",
  ui: "These are labels, headings and button texts from a pharmacy app. Use short, natural, everyday words.",
};

export function buildTranslatePrompts(req: TranslateRequest): { system: string; user: string } {
  const lang = LANGUAGE[req.target as Exclude<SummaryLang, "en">];
  const system = loadPrompt("translate-system.md", { LANGUAGE: lang.name, STYLE: STYLE[req.level], SCRIPT_RULE: `10. ${lang.script}` });
  const texts = JSON.stringify(req.texts.map((text, i) => ({ i, text })), null, 1);
  const user = loadPrompt("translate-user.md", { LANGUAGE: lang.name, COUNT: req.texts.length, TEXTS: texts });
  return { system, user };
}

/**
 * Website labels (level "ui") are the same for everybody, so they are remembered
 * on the server too. Prescription texts are NEVER kept on the server.
 */
const uiCache = new Map<string, string>();
const uiKey = (lang: string, text: string) => `${lang}\u0000${text}`;

export async function translateTexts(req: TranslateRequest): Promise<string[]> {
  if (process.env.AI_MOCK) {
    // Test mode: no AI call; mark the text so you can see where translations appear.
    await new Promise((r) => setTimeout(r, 800));
    return req.texts.map((t) => `[${req.target}] ${t}`);
  }

  const cached = req.level === "ui" ? req.texts.map((t) => uiCache.get(uiKey(req.target, t))) : [];
  if (req.level === "ui" && cached.every((c) => c !== undefined)) return cached as string[];

  const { system, user } = buildTranslatePrompts(req);
  const { translations } = await askForJson({
    system,
    content: user,
    schema: translationsFor(req.texts.length),
    maxTokens: AI_MAX_TOKENS.translate,
  });

  if (req.level === "ui") {
    if (uiCache.size > 5000) uiCache.clear();
    req.texts.forEach((t, i) => uiCache.set(uiKey(req.target, t), translations[i]));
  }
  return translations;
}
