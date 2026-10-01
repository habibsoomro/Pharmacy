"use client";

import { createContext, useContext, type ReactNode } from "react";
import { getDir, type Locale } from "@/lib/locales";
import { LANG_INFO, type SummaryLang } from "@/lib/languages";
import type { Dictionary } from "@/lib/i18n";

/**
 * locale = the website's language (menus, buttons).
 * lang   = the language this part of the page is shown in. It is the same as
 *          locale everywhere except inside a summary shown in an extra language
 *          (Roman Urdu, Punjabi, Pashto, Balochi).
 */
type I18nValue = { locale: Locale; lang: SummaryLang; dir: "ltr" | "rtl"; t: Dictionary };
const I18nContext = createContext<I18nValue | null>(null);

/** Gives interactive (client) components the current language. */
export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dictionary; children: ReactNode }) {
  return <I18nContext.Provider value={{ locale, lang: locale, dir: getDir(locale), t: dict }}>{children}</I18nContext.Provider>;
}

/** Shows everything inside it in another language (used by the summary). */
export function LanguageScope({ lang, dict, children }: { lang: SummaryLang; dict: Dictionary; children: ReactNode }) {
  const parent = useI18n();
  return <I18nContext.Provider value={{ locale: parent.locale, lang, dir: LANG_INFO[lang].dir, t: dict }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>");
  return value;
}
