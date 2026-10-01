import type { Locale } from "@/lib/locales";

/** "2026-10-02" → "2 Oct 2026" (English) or the Urdu/Sindhi equivalent where the phone supports it. */
export function formatDate(iso: string, locale: Locale): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const tag = locale === "ur" ? "ur-PK" : locale === "sd" ? "sd-PK" : "en-GB";
  try {
    return new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
  } catch {
    return iso;
  }
}
