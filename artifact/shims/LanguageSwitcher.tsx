"use client";

import { useSettings } from "@/components/SettingsProvider";
import { LOCALES, LOCALE_LABELS, getDir, type Locale } from "@/lib/locales";
import { setLocale } from "../store";

/** Same as components/LanguageSwitcher, but the language is kept on the phone instead of a cookie. */
export function applySiteLocale(locale: Locale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = getDir(locale);
  setLocale(locale);
}

export function LanguageSwitcher({ current, label }: { current: Locale; label: string }) {
  const { settings, update } = useSettings();

  function choose(locale: Locale) {
    if (settings.summaryLang) update({ summaryLang: null });
    if (locale !== current) applySiteLocale(locale);
  }

  return (
    <div role="group" aria-label={label} className="flex shrink-0 rounded-full border border-line bg-card p-0.5">
      {LOCALES.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            onClick={() => choose(locale)}
            aria-pressed={active}
            className={[
              "min-h-9 rounded-full px-2.5 text-sm transition-colors sm:px-3",
              locale === "ur" ? "font-[family-name:var(--font-urdu)] leading-[1.7]" : "",
              locale === "sd" ? "font-[family-name:var(--font-sindhi)]" : "",
              locale === "en" ? "latin" : "",
              active ? "bg-brand text-white" : "text-ink hover:bg-surface",
            ].join(" ")}
          >
            {LOCALE_LABELS[locale]}
          </button>
        );
      })}
    </div>
  );
}
