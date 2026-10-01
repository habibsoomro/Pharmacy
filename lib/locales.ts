// Small, browser-safe language constants (no translation text here,
// so the phone only downloads the one language it needs).
export const LOCALES = ["en", "ur", "sd"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "nuskha_lang";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ur: "اردو",
  sd: "سنڌي",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function getDir(locale: Locale): "ltr" | "rtl" {
  return locale === "en" ? "ltr" : "rtl";
}

/** Pick the right language from a { en, ur, sd } object in config. */
export function pick<T>(value: Record<Locale, T>, locale: Locale): T {
  return value[locale] ?? value.en;
}
