"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useI18n } from "@/components/I18nProvider";
import { AlertIcon, CameraIcon, SpinnerIcon, TrashIcon } from "@/components/icons";
import { fmt, formatBytes } from "@/lib/format";
import { clearTranslations } from "@/lib/client/translate";
import { loadCurrentScan, saveCurrentScan } from "@/lib/client/scan-session";
import {
  HistoryUnavailableError, deleteAllHistory, deleteFromHistory, listHistory, loadFromHistory, matchesSearch, storageUsed, type SavedPrescription,
} from "@/lib/client/history";
import { parseRxDate } from "@/lib/summary/dates";
import { formatDate } from "@/lib/summary/format";

type LoadError = "unavailable" | "failed" | null;

/** If the prescription open in this tab was just deleted, it is no longer "saved". */
function forgetInThisTab(id?: string) {
  const current = loadCurrentScan();
  if (current?.historyId && (!id || current.historyId === id)) {
    const { historyId: _gone, ...rest } = current;
    saveCurrentScan(rest);
  }
}

export function HistoryScreen() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const h = t.history;
  const [items, setItems] = useState<SavedPrescription[] | null>(null);
  const [error, setError] = useState<LoadError>(null);
  const [query, setQuery] = useState("");
  const [opening, setOpening] = useState<string | null>(null);
  const [openFailed, setOpenFailed] = useState(false);
  const [used, setUsed] = useState<number | null>(null);
  const [deletedAll, setDeletedAll] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setItems(await listHistory());
      setError(null);
    } catch (e) {
      setItems([]);
      setError(e instanceof HistoryUnavailableError ? "unavailable" : "failed");
    }
    setUsed(await storageUsed());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function open(id: string) {
    setOpening(id);
    setOpenFailed(false);
    try {
      const scan = await loadFromHistory(id);
      if (!scan) throw new Error("missing");
      saveCurrentScan(scan);
      router.push("/summary");
    } catch {
      setOpenFailed(true);
      setOpening(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(h.deleteConfirm)) return;
    await deleteFromHistory(id).catch(() => {});
    forgetInThisTab(id);
    setDeletedAll(false);
    refresh();
  }

  async function removeAll() {
    if (!window.confirm(h.deleteAllConfirm)) return;
    await deleteAllHistory().catch(() => {});
    clearTranslations(); // saved translations can contain prescription text too
    forgetInThisTab();
    setDeletedAll(true);
    refresh();
  }

  const date = (raw: string | null) => {
    const iso = parseRxDate(raw);
    return iso ? formatDate(iso, locale) : raw;
  };

  if (items === null) {
    return (
      <div className="space-y-3" aria-busy="true">
        <p className="sr-only">{h.loading}</p>
        {[0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-card" />)}
      </div>
    );
  }

  const shown = items.filter((x) => matchesSearch(x, query));

  return (
    <div className="space-y-4">
      {error === "unavailable" && <Notice>{h.unavailable}</Notice>}
      {error === "failed" && <Notice>{h.openFailed}</Notice>}
      {openFailed && <Notice>{h.openFailed}</Notice>}
      {deletedAll && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-900" role="status">{h.deletedAll}</p>}

      {items.length === 0 && !error ? (
        <div className="rounded-2xl border border-dashed border-line bg-card p-6 text-center">
          <p className="font-semibold">{h.empty}</p>
          <p className="mt-1 text-sm text-muted">{h.emptyHint}</p>
          <Link href="/scan" className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand px-5 font-semibold text-white">
            <CameraIcon className="size-5" />{h.scan}
          </Link>
        </div>
      ) : items.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{fmt(h.count, { n: items.length })}</p>
            <button type="button" onClick={removeAll}
              className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-red-300 px-4 text-sm font-semibold text-red-800 hover:bg-red-50">
              <TrashIcon className="size-4" />{h.deleteAll}
            </button>
          </div>

          {items.length > 3 && (
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={h.search} aria-label={h.search}
              className="min-h-12 w-full rounded-xl border border-line bg-card px-4 text-base" />
          )}
          {shown.length === 0 && <p className="text-muted">{h.noMatch}</p>}

          <ul className="space-y-3">
            {shown.map((x) => (
              <li key={x.id} className="rounded-2xl border border-line bg-card p-3">
                <div className="flex gap-3">
                  {x.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a tiny picture saved on the phone, not a web image
                    <img src={x.thumb} alt="" className="h-24 w-20 shrink-0 rounded-lg border border-line bg-white object-cover" />
                  ) : (
                    <div className="grid h-24 w-20 shrink-0 place-items-center rounded-lg border border-dashed border-line px-1 text-center text-xs text-muted">{h.noPhoto}</div>
                  )}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="font-bold">
                      {x.info.patient ? <bdi dir="ltr" className="latin">{x.info.patient}</bdi> : <span className="text-muted">{h.noName}</span>}
                    </p>
                    {x.info.doctor && <p className="text-sm"><bdi dir="ltr" className="latin">{x.info.doctor}</bdi></p>}
                    {x.info.prescriptionDate && <p className="text-sm text-muted">{fmt(h.rxDate, { date: date(x.info.prescriptionDate) ?? "" })}</p>}
                    <p className="text-xs text-muted">{fmt(h.savedOn, { date: formatDate(x.savedAt.slice(0, 10), locale) })}</p>
                  </div>
                </div>

                {x.info.medicines.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-muted">{fmt(h.medicines, { n: x.info.medicines.length })}</p>
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {x.info.medicines.slice(0, 5).map((m, i) => (
                        <li key={i} className="rounded-full bg-surface px-2.5 py-0.5 text-sm"><bdi dir="ltr" className="latin">{m}</bdi></li>
                      ))}
                      {x.info.medicines.length > 5 && <li className="px-1 text-sm text-muted">{fmt(h.more, { n: x.info.medicines.length - 5 })}</li>}
                    </ul>
                  </div>
                )}
                {x.info.seriousAlerts > 0 && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-800">
                    <AlertIcon className="size-3.5" />{fmt(h.serious, { n: x.info.seriousAlerts })}
                  </p>
                )}

                <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                  <button type="button" onClick={() => open(x.id)} disabled={opening !== null}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-white disabled:opacity-70">
                    {opening === x.id && <SpinnerIcon className="size-5" />}
                    {opening === x.id ? h.opening : h.open}
                  </button>
                  <button type="button" onClick={() => remove(x.id)} aria-label={`${h.delete}: ${x.info.patient ?? h.noName}`}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-line px-4 font-semibold text-red-800 hover:border-red-300">
                    <TrashIcon className="size-5" /><span>{h.delete}</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="space-y-1 text-sm text-muted">
        <p>{h.sharedPhone}</p>
        {used !== null && used > 0 && <p>{fmt(h.storage, { size: formatBytes(used) })}</p>}
      </div>
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="alert">
      <AlertIcon className="mt-0.5 size-4 shrink-0" />{children}
    </p>
  );
}
