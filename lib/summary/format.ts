import { LANG_INFO, type SummaryLang } from "@/lib/languages";

/** "2026-10-02" → "2 Oct 2026" (English) or the same date in the summary's language where the phone supports it. */
export function formatDate(iso: string, lang: SummaryLang): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  try {
    return new Intl.DateTimeFormat(LANG_INFO[lang].dateTag, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
  } catch {
    return iso;
  }
}
