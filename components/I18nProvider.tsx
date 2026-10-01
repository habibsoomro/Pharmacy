"use client";

import { createContext, useContext, type ReactNode } from "react";
import { getDir, type Locale } from "@/lib/locales";
import type { Dictionary } from "@/lib/i18n";

type I18nValue = { locale: Locale; dir: "ltr" | "rtl"; t: Dictionary };
const I18nContext = createContext<I18nValue | null>(null);

/** Gives interactive (client) components the current language. */
export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dictionary; children: ReactNode }) {
  return <I18nContext.Provider value={{ locale, dir: getDir(locale), t: dict }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>");
  return value;
}
