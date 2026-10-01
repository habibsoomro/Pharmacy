import "server-only";
import en from "@/locales/en.json";
import ur from "@/locales/ur.json";
import sd from "@/locales/sd.json";
import type { Locale } from "@/lib/locales";

export type Dictionary = typeof en;

// TypeScript checks that ur.json and sd.json have every key that en.json has.
// If you add a line to en.json and forget the others, `npm run typecheck` will tell you.
const dictionaries: Record<Locale, Dictionary> = { en, ur, sd };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
