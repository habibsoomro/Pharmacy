/**
 * Small helpers for translating the summary. No browser or server code here,
 * so they can be tested on their own.
 */

/** Parts of the translation files that appear inside the summary. Only used for the extra languages. */
export const SUMMARY_DICT_PATHS = [
  "common.disclaimer",
  "review.fields",
  "review.med",
  "review.food",
  "review.legibility",
  "review.confidence",
  "review.poorWarning",
  "poor",
  "summary",
  "safety",
] as const;

type Tree = { [k: string]: unknown };

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Tree)[k] : undefined), obj);
}

/** Every piece of text under `paths`, as [path, text] pairs ("summary.med.days" → "{n} days"). */
export function flattenStrings(dict: unknown, paths: readonly string[] = SUMMARY_DICT_PATHS): [string, string][] {
  const out: [string, string][] = [];
  const walk = (v: unknown, p: string) => {
    if (typeof v === "string") out.push([p, v]);
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}.${i}`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, `${p}.${k}`);
  };
  for (const p of paths) walk(getPath(dict, p), p);
  return out;
}

/** A copy of `dict` with some texts replaced (by path). Anything not replaced stays as it was. */
export function withStrings<T>(dict: T, replacements: Record<string, string>): T {
  const copy = structuredClone(dict) as unknown;
  for (const [path, value] of Object.entries(replacements)) {
    const keys = path.split(".");
    const last = keys.pop()!;
    const parent = keys.reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Tree)[k] : undefined), copy);
    if (parent && typeof parent === "object" && typeof (parent as Tree)[last] === "string") (parent as Tree)[last] = value;
  }
  return copy as T;
}

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");

/**
 * Is this translation safe to show? It must not be empty, must keep every
 * {placeholder} and must not be wildly longer than the original (a sign the AI added something).
 */
export function translationOk(source: string, translated: unknown): translated is string {
  if (typeof translated !== "string" || !translated.trim()) return false;
  if (placeholders(source) !== placeholders(translated)) return false;
  return translated.length <= source.length * 4 + 80;
}

/** Split texts into groups small enough for one AI request each. */
export function chunkTexts(texts: string[], maxCount = 60, maxChars = 6000): string[][] {
  const chunks: string[][] = [];
  let cur: string[] = [];
  let chars = 0;
  for (const t of texts) {
    if (cur.length && (cur.length >= maxCount || chars + t.length > maxChars)) {
      chunks.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(t);
    chars += t.length;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

/** Texts worth sending: unique, not empty, and not just numbers, dates or symbols. */
export function translatable(texts: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  for (const t of texts) {
    const s = t?.trim();
    if (s && /\p{L}/u.test(s) && s.length <= 2000) seen.add(s);
  }
  return [...seen];
}
