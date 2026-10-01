"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useSettings } from "@/components/SettingsProvider";
import { LOCALES, LOCALE_COOKIE, LOCALE_LABELS, getDir, type Locale } from "@/lib/locales";

/** Remember the website language for one year and flip the page direction straight away. */
export function applySiteLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  // Flip direction straight away so the page doesn't feel slow on a weak connection.
  document.documentElement.lang = locale;
  document.documentElement.dir = getDir(locale);
}

export function LanguageSwitcher({ current, label }: { current: Locale; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { settings, update } = useSettings();

  function choose(locale: Locale) {
    // Choosing a website language also brings the summary back to it (from Roman Urdu, Pashto…).
    if (settings.summaryLang) update({ summaryLang: null });
    if (locale === current) return;
    applySiteLocale(locale);
    startTransition(() => router.refresh());
  }

  return (
    <div role="group" aria-label={label} className="flex shrink-0 rounded-full border border-line bg-card p-0.5" aria-busy={pending}>
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
