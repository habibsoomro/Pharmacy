/**
 * Helpers for "Read aloud" (the phone's own speech engine, no internet needed).
 * Kept free of browser calls so they can be tested.
 */

type VoiceLike = { lang: string; name: string; localService?: boolean; default?: boolean };

const norm = (lang: string) => lang.toLowerCase().replace(/_/g, "-");

/** The best voice for a language: tries each code in order ("ur-PK", then "ur"…), preferring voices that work offline. */
export function findVoice<V extends VoiceLike>(voices: V[], codes: string[]): V | null {
  for (const code of codes) {
    const c = norm(code);
    const matches = voices.filter((v) => norm(v.lang) === c || norm(v.lang).startsWith(`${c}-`));
    if (matches.length) return matches.find((v) => v.localService) ?? matches[0];
  }
  return null;
}

/**
 * Splits the summary into short pieces. Phones often stop speaking in the
 * middle of long texts, so each piece is one line or sentence (max ~200 letters).
 * Emojis and bullet symbols are removed so they aren't read out.
 */
export function speechChunks(text: string, max = 200): string[] {
  const cleaned = text
    .replace(/\p{Extended_Pictographic}|️|‍/gu, "")
    .replace(/[•⚠]/g, "")
    .replace(/[ \t]+/g, " ");
  const out: string[] = [];
  for (const raw of cleaned.split(/\n+/)) {
    const lineText = raw.trim();
    if (!lineText || !/[\p{L}\p{N}]/u.test(lineText)) continue;
    if (lineText.length <= max) {
      out.push(lineText);
      continue;
    }
    // Split long lines after a full stop (English, Urdu "۔", Arabic "؟") or comma, keeping each piece under `max`.
    let cur = "";
    for (const part of lineText.split(/(?<=[.!?۔؟،,;])\s+/)) {
      if (cur && (cur + " " + part).length > max) {
        out.push(cur);
        cur = part;
      } else {
        cur = cur ? `${cur} ${part}` : part;
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}
