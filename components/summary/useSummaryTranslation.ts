"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dictionary } from "@/lib/i18n";
import { isSiteLocale, type SummaryLang } from "@/lib/languages";
import type { Settings } from "@/lib/settings";
import { cachedTranslations, translateTexts } from "@/lib/client/translate";
import { flattenStrings, translatable, withStrings } from "@/lib/translate/core";
import type { Tx } from "@/lib/summary/share-text";

export type TranslationStatus = "idle" | "working" | "done" | "failed";

type State = { dynamic: Record<string, string>; ui: Record<string, string> | null; status: TranslationStatus };

/** Labels for the extra languages are translated from the English file (downloaded only when needed). */
async function englishLabels(): Promise<[string, string][]> {
  const en = (await import("@/locales/en.json")).default;
  return flattenStrings(en);
}

const byPath = (entries: [string, string][], map: Record<string, string>) =>
  Object.fromEntries(entries.filter(([, text]) => map[text.trim()] !== undefined).map(([path, text]) => [path, map[text.trim()]]));

/**
 * Translates the summary into `lang`:
 *  - texts from the prescription and safety check (always, unless English), at the chosen reading level;
 *  - for Roman Urdu, Punjabi, Pashto and Balochi also the summary's labels and headings.
 * Saved translations show instantly; new ones are fetched in the background, with English shown meanwhile.
 */
export function useSummaryTranslation(opts: {
  lang: SummaryLang;
  level: Settings["level"];
  siteDict: Dictionary;
  sources: string[];
  enabled: boolean;
}): { dict: Dictionary; tx: Tx; status: TranslationStatus; retry: () => void } {
  const { lang, level, siteDict, sources, enabled } = opts;
  const [state, setState] = useState<State>({ dynamic: {}, ui: null, status: "idle" });
  const [attempt, setAttempt] = useState(0);
  const sourcesKey = JSON.stringify(sources);

  useEffect(() => {
    if (!enabled) return;
    if (lang === "en") {
      setState({ dynamic: {}, ui: null, status: "idle" });
      return;
    }
    let cancelled = false;
    const extra = !isSiteLocale(lang);
    const texts = JSON.parse(sourcesKey) as string[];

    (async () => {
      const labels = extra ? await englishLabels() : [];
      const labelTexts = translatable(labels.map(([, text]) => text));

      // 1. Whatever is already saved on the phone, straight away.
      const savedDynamic = cachedTranslations(texts, lang, level);
      const savedUi = cachedTranslations(labelTexts, lang, "ui");
      const needed = texts.some((t) => savedDynamic[t] === undefined) || labelTexts.some((t) => savedUi[t] === undefined);
      if (cancelled) return;
      setState({ dynamic: savedDynamic, ui: extra ? byPath(labels, savedUi) : null, status: needed ? "working" : "done" });
      if (!needed) return;

      // 2. The rest from the AI.
      const [ui, dynamic] = await Promise.all([
        extra ? translateTexts(labelTexts, lang, "ui") : Promise.resolve(null),
        texts.length ? translateTexts(texts, lang, level) : Promise.resolve({ map: {}, complete: true, error: null }),
      ]);
      if (cancelled) return;
      setState({
        dynamic: dynamic.map,
        ui: ui ? byPath(labels, ui.map) : null,
        status: dynamic.complete && (ui?.complete ?? true) ? "done" : "failed",
      });
    })().catch(() => {
      if (!cancelled) setState((s) => ({ ...s, status: "failed" }));
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, lang, level, sourcesKey, attempt]);

  const dict = useMemo(() => (state.ui && Object.keys(state.ui).length ? withStrings(siteDict, state.ui) : siteDict), [siteDict, state.ui]);
  const dynamic = state.dynamic;
  const tx = useCallback<Tx>(((s: string | null | undefined) => (typeof s === "string" ? (dynamic[s.trim()] ?? s) : s)) as Tx, [dynamic]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { dict, tx, status: lang === "en" ? "idle" : state.status, retry };
}
