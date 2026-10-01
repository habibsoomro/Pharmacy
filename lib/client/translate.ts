import type { SummaryLang } from "@/lib/languages";
import type { TranslateRequest, TranslateResponse } from "@/lib/schemas/translate";
import { aiTransport } from "@/lib/client/ai-transport";
import { chunkTexts, translationOk } from "@/lib/translate/core";

export type TranslateLevel = "simple" | "detailed" | "ui";

/**
 * Translations are remembered on this phone (localStorage), so the same text is
 * never paid for twice and works again without internet. One store per language
 * and reading level. Nothing is kept on the server.
 */
const PREFIX = "nuskha:tr:";
const MAX_ENTRIES = 1500;
const memory = new Map<string, Record<string, string>>();

const storeKey = (lang: SummaryLang, level: TranslateLevel) => `${PREFIX}${lang}:${level}`;

function readStore(key: string): Record<string, string> {
  const inMemory = memory.get(key);
  if (inMemory) return inMemory;
  let store: Record<string, string> = {};
  try {
    const raw = localStorage.getItem(key);
    if (raw) store = JSON.parse(raw) as Record<string, string>;
  } catch {
    store = {};
  }
  memory.set(key, store);
  return store;
}

function writeStore(key: string, store: Record<string, string>) {
  // Oldest entries first: drop them when the store gets big.
  const keys = Object.keys(store);
  if (keys.length > MAX_ENTRIES) for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) delete store[k];
  memory.set(key, store);
  try {
    localStorage.setItem(key, JSON.stringify(store));
  } catch {
    /* storage full: still works for this visit */
  }
}

/** Already-saved translations only (instant, no internet). */
export function cachedTranslations(texts: string[], lang: SummaryLang, level: TranslateLevel): Record<string, string> {
  const store = readStore(storeKey(lang, level));
  const out: Record<string, string> = {};
  for (const t of texts) if (store[t] !== undefined) out[t] = store[t];
  return out;
}

export type TranslateResult = { map: Record<string, string>; complete: boolean; error: string | null };

/** Texts being translated right now, so the same text is never sent twice at the same time. */
const inflight = new Map<string, Promise<void>>();
/** Texts whose AI translation failed our check this visit: shown in English, not asked for again and again. */
const rejected = new Set<string>();

/** Translate texts with the AI (through our server), using saved translations where possible. */
export async function translateTexts(texts: string[], lang: SummaryLang, level: TranslateLevel): Promise<TranslateResult> {
  const key = storeKey(lang, level);
  const store = readStore(key);
  const missing = texts.filter((t) => store[t] === undefined && !rejected.has(`${key}\u0000${t}`));
  const waitFor = [...new Set(missing.map((t) => inflight.get(`${key}\u0000${t}`)).filter((p): p is Promise<void> => !!p))];
  const toSend = missing.filter((t) => !inflight.has(`${key}\u0000${t}`));
  let error: string | null = null;

  if (toSend.length) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      error = "offline";
    } else {
      const job = (async () => {
        const chunks = chunkTexts(toSend, 40, 4000);
        // Two requests at a time: quicker on slow internet without flooding the server.
        for (let i = 0; i < chunks.length; i += 2) {
          const results = await Promise.all(chunks.slice(i, i + 2).map((c) => requestChunk(c, lang, level)));
          results.forEach((r, j) => {
            if (!r.ok) {
              error ??= r.error;
              return;
            }
            // A translation that lost a {placeholder} or looks wrong is not used; the English stays.
            chunks[i + j].forEach((source, k) => {
              if (translationOk(source, r.translations[k])) store[source] = r.translations[k];
              else rejected.add(`${key}\u0000${source}`);
            });
          });
          if (error === "rate_limited") break;
        }
        writeStore(key, store);
      })();
      toSend.forEach((t) => inflight.set(`${key}\u0000${t}`, job));
      try {
        await job;
      } finally {
        toSend.forEach((t) => inflight.delete(`${key}\u0000${t}`));
      }
    }
  }
  await Promise.all(waitFor);

  const map: Record<string, string> = {};
  for (const t of texts) if (store[t] !== undefined) map[t] = store[t];
  const complete = !error && texts.every((t) => store[t] !== undefined || rejected.has(`${key}\u0000${t}`));
  return { map, complete, error };
}

async function requestChunk(texts: string[], target: SummaryLang, level: TranslateLevel): Promise<TranslateResponse> {
  try {
    const { status, data } = await aiTransport.translate({ target: target as TranslateRequest["target"], level, texts });
    if (data?.ok && Array.isArray(data.translations) && data.translations.length === texts.length) return data;
    return { ok: false, error: data && !data.ok ? data.error : status === 429 ? "rate_limited" : "ai_failed" };
  } catch {
    return { ok: false, error: navigator.onLine ? "ai_failed" : "offline" };
  }
}

/** Forget every saved translation on this phone. */
export function clearTranslations() {
  memory.clear();
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}
