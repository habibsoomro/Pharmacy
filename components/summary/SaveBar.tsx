"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { useSettings } from "@/components/SettingsProvider";
import { CheckIcon, SpinnerIcon } from "@/components/icons";
import { HistoryUnavailableError, askToKeepStorage, makeThumb, saveToHistory } from "@/lib/client/history";
import { loadCurrentScan, saveCurrentScan, type CurrentScan } from "@/lib/client/scan-session";

type State = "idle" | "saving" | "saved" | "failed" | "unavailable";

/** "Save to My prescriptions" on the summary. Saved scans stay only on this phone. */
export function SaveBar({ scan, onSaved }: { scan: CurrentScan; onSaved: (scan: CurrentScan) => void }) {
  const { t } = useI18n();
  const { settings, loaded } = useSettings();
  const [state, setState] = useState<State>(scan.historyId ? "saved" : "idle");
  const [noPhotos, setNoPhotos] = useState(false);
  const busy = useRef(false);
  const s = t.summary.save;

  const save = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setState("saving");
    try {
      // Use the newest copy (it may already include the finished safety check).
      const latest = loadCurrentScan() ?? scan;
      const thumb = await makeThumb(latest.images);
      const { id, withoutPhotos } = await saveToHistory(latest, { thumb });
      const saved = { ...latest, historyId: id };
      saveCurrentScan(saved);
      setNoPhotos(withoutPhotos);
      setState("saved");
      onSaved(saved);
      askToKeepStorage();
    } catch (e) {
      setState(e instanceof HistoryUnavailableError ? "unavailable" : "failed");
    } finally {
      busy.current = false;
    }
  }, [scan, onSaved]);

  // "Save summaries automatically" in Settings.
  useEffect(() => {
    if (loaded && settings.autoSave && !scan.historyId && state === "idle") save();
  }, [loaded, settings.autoSave, scan.historyId, state, save]);

  useEffect(() => {
    if (scan.historyId) setState("saved");
  }, [scan.historyId]);

  return (
    <div className="no-print rounded-2xl border border-line bg-card p-3" aria-live="polite">
      {state === "saved" ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-semibold text-emerald-800">
            <span className="grid size-7 place-items-center rounded-full bg-emerald-600 text-white"><CheckIcon className="size-4" /></span>
            {s.saved}
          </p>
          <Link href="/history" className="min-h-10 rounded-lg px-3 py-2 text-sm font-semibold text-brand underline underline-offset-4">{s.seeAll}</Link>
        </div>
      ) : (
        <button type="button" onClick={save} disabled={state === "saving" || state === "unavailable"}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-brand font-semibold text-brand disabled:opacity-60">
          {state === "saving" && <SpinnerIcon className="size-5" />}
          {state === "saving" ? s.saving : s.button}
        </button>
      )}
      <p className="mt-1.5 text-xs text-muted">{s.hint}</p>
      {noPhotos && <p className="mt-1 text-sm text-amber-800">{s.noPhotos}</p>}
      {state === "failed" && <p className="mt-1 text-sm text-red-700" role="alert">{s.failed}</p>}
      {state === "unavailable" && <p className="mt-1 text-sm text-amber-800" role="alert">{s.unavailable}</p>}
    </div>
  );
}
