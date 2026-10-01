import { LOCALES, type Locale } from "@/lib/locales";

/**
 * Languages the SUMMARY can be shown in. The website itself (menus, buttons) uses
 * English, Urdu or Sindhi from the translation files; the extra languages below
 * are translated by the AI for the summary only.
 */
export const SUMMARY_LANGS = ["en", "ur", "sd", "roman", "pa", "ps", "bal"] as const;
export type SummaryLang = (typeof SUMMARY_LANGS)[number];

export const EXTRA_LANGS = ["roman", "pa", "ps", "bal"] as const;
export type ExtraLang = (typeof EXTRA_LANGS)[number];

type Script = "latin" | "nastaliq" | "naskh";

export type LangInfo = {
  /** Name in its own script, shown on buttons. */
  label: string;
  /** Name in English, shown next to the native name. */
  english: string;
  dir: "ltr" | "rtl";
  script: Script;
  beta: boolean;
  /** Used for <html lang> / lang attributes. */
  tag: string;
  /** Date formatting (falls back to English if the phone doesn't know it). */
  dateTag: string;
  /** Phone voices that can read this language, best first (matched by prefix). */
  voices: string[];
};

export const LANG_INFO: Record<SummaryLang, LangInfo> = {
  en: { label: "English", english: "English", dir: "ltr", script: "latin", beta: false, tag: "en", dateTag: "en-GB", voices: ["en-PK", "en-IN", "en-GB", "en"] },
  ur: { label: "اردو", english: "Urdu", dir: "rtl", script: "nastaliq", beta: false, tag: "ur", dateTag: "ur-PK", voices: ["ur-PK", "ur-IN", "ur"] },
  sd: { label: "سنڌي", english: "Sindhi", dir: "rtl", script: "naskh", beta: false, tag: "sd", dateTag: "sd-PK", voices: ["sd"] },
  // Roman Urdu is written in English letters, so an Indian/Pakistani English voice reads it best.
  roman: { label: "Roman Urdu", english: "Roman Urdu", dir: "ltr", script: "latin", beta: false, tag: "ur-Latn", dateTag: "en-GB", voices: ["en-PK", "en-IN", "en"] },
  pa: { label: "پنجابی", english: "Punjabi", dir: "rtl", script: "nastaliq", beta: true, tag: "pa-Arab", dateTag: "pa-Arab-PK", voices: ["pa-PK", "pa-Arab"] },
  ps: { label: "پښتو", english: "Pashto", dir: "rtl", script: "naskh", beta: true, tag: "ps", dateTag: "ps-PK", voices: ["ps"] },
  bal: { label: "بلوچی", english: "Balochi", dir: "rtl", script: "naskh", beta: true, tag: "bal", dateTag: "ur-PK", voices: ["bal"] },
};

export function isSiteLocale(lang: SummaryLang): lang is Locale {
  return (LOCALES as readonly string[]).includes(lang);
}

export function isExtraLang(value: unknown): value is ExtraLang {
  return typeof value === "string" && (EXTRA_LANGS as readonly string[]).includes(value);
}

/** CSS class that picks the right font for the summary's language. */
export function scriptClass(lang: SummaryLang): string {
  return `script-${LANG_INFO[lang].script}`;
}
