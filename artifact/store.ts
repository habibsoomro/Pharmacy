import { useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/locales";

/**
 * The single-page version has no server and no URLs to change: which "page" is
 * showing and the website language live here. The language is remembered on the
 * phone (localStorage) instead of in a cookie.
 */
export const PAGES = ["/", "/scan", "/review", "/summary", "/history", "/about", "/contact", "/privacy"] as const;
export type PagePath = (typeof PAGES)[number];

const LANG_KEY = "nuskha:lang";

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    /* ignore */
  }
  const nav = (navigator.language || "").toLowerCase();
  return nav.startsWith("ur") ? "ur" : nav.startsWith("sd") ? "sd" : DEFAULT_LOCALE;
}

function initialPage(): PagePath {
  // A link to the page can open a section directly, e.g. …#scan or …#history.
  const hash = `/${location.hash.replace(/^#/, "")}`;
  return (PAGES as readonly string[]).includes(hash) ? (hash as PagePath) : "/";
}

let state = { page: initialPage(), locale: initialLocale() };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function go(path: string) {
  const clean = (path.split("#")[0] || "/") as PagePath;
  state = { ...state, page: (PAGES as readonly string[]).includes(clean) ? clean : "/" };
  emit();
  window.scrollTo({ top: 0 });
}

export function setLocale(locale: Locale) {
  try {
    localStorage.setItem(LANG_KEY, locale);
  } catch {
    /* ignore */
  }
  state = { ...state, locale };
  emit();
}

export function useAppState() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
