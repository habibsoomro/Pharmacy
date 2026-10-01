"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "@/components/I18nProvider";
import { useSettings } from "@/components/SettingsProvider";
import { fmt } from "@/lib/format";
import { loadCurrentScan, saveCurrentScan, type CurrentScan } from "@/lib/client/scan-session";
import {
  TOP_FIELDS, attentionCount, attentionPaths, finalPrescription, getTop, initReview, isVisible, newReviewMed, setTop,
  type ReviewState, type TopSection,
} from "@/lib/rx/review";
import { FieldRow, TextInput } from "@/components/review/FieldRow";
import { MedicineEditor } from "@/components/review/MedicineEditor";
import { PhotoPane, PhotoViewer } from "@/components/review/PhotoPane";
import { AlertIcon, CheckIcon, PlusIcon } from "@/components/icons";

export function ReviewScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [scan, setScan] = useState<CurrentScan | null | undefined>(undefined); // undefined = still loading
  const [state, setState] = useState<ReviewState | null>(null);
  // Pharmacist mode here is the same setting as "Pharmacist view" in Settings.
  const { settings, update } = useSettings();
  const pharmacist = settings.view === "pharmacist";
  const [photoOpen, setPhotoOpen] = useState(false);

  useEffect(() => {
    const s = loadCurrentScan();
    setScan(s);
    // Coming back from the summary: start from the already-checked version.
    if (s?.result.is_prescription) setState(initReview(s.result, s.review ? [] : s.checks));
  }, []);

  if (scan === undefined) return null;

  if (!scan || !state) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-8">
        <p className="rounded-xl border border-line bg-card p-5">{t.review.noScan}</p>
        <Link href="/scan" className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-brand px-5 font-semibold text-white">
          {t.review.scanNow}
        </Link>
      </div>
    );
  }

  const confirm = (path: string) => setState((s) => s && (s.confirmed.includes(path) ? s : { ...s, confirmed: [...s.confirmed, path] }));
  const remaining = attentionCount(state, pharmacist);

  function togglePharmacist(on: boolean) {
    update({ view: on ? "pharmacist" : "patient" });
  }

  function jumpToFirst() {
    const path = attentionPaths(state!, pharmacist)[0];
    const el = path ? document.getElementById(`field-${path}`) : document.getElementById("unreadable-section");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    (el?.querySelector("input, select, textarea") as HTMLElement | null)?.focus({ preventScroll: true });
  }

  function finish() {
    const s = state!;
    const kept = s.meds.filter((m) => m.data.brand_name || m.data.generic_name);
    const original = scan!.review?.original ?? scan!.result;
    const updated: CurrentScan = {
      ...scan!,
      result: finalPrescription(s),
      review: {
        reviewedAt: new Date().toISOString(),
        pharmacistMode: pharmacist,
        original,
        confirmedCount: s.confirmed.length,
        stillFlagged: remaining,
        generalNote: s.generalNote,
        medicineNotes: kept.map((m) => m.note),
      },
    };
    saveCurrentScan(updated);
    router.push("/summary");
  }

  const rx = state.rx;
  const sections: { key: TopSection; title: string }[] = [
    { key: "doctor", title: t.review.sections.doctor },
    { key: "patient", title: t.review.sections.patient },
    { key: "clinical", title: t.review.sections.clinical },
  ];
  const unmatched = state.unreadable.map((u, i) => ({ ...u, i })).filter((u) => !u.matched);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-8">
      {/* Desktop: photo stays beside the form */}
      <aside className="hidden lg:block">
        <div className="sticky top-4 flex h-[calc(100dvh-2rem)] flex-col">
          <h2 className="pb-2 font-semibold">{t.review.photoTitle}</h2>
          <PhotoPane images={scan.images} className="flex-1" />
        </div>
      </aside>

      <div className="min-w-0 space-y-6 pb-28 lg:pb-8">
        <header className="space-y-3">
          <h1 className="text-2xl font-bold text-brand sm:text-3xl">{t.review.title}</h1>
          <p className="text-muted">{t.review.intro}</p>

          {rx.overall_legibility === "poor" && (
            <p className="flex gap-2 rounded-xl border-2 border-red-300 bg-red-50 p-4 font-semibold text-red-800" role="alert">
              <AlertIcon className="mt-1 size-5 shrink-0" />
              {t.review.poorWarning}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted">{t.review.legibility[rx.overall_legibility]}</span>
            <label className="ms-auto flex cursor-pointer items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-sm">
              <input type="checkbox" checked={pharmacist} onChange={(e) => togglePharmacist(e.target.checked)} className="size-4 accent-[var(--brand)]" />
              <span className="font-medium">{t.review.pharmacistMode}</span>
            </label>
          </div>
          {pharmacist && <p className="text-xs text-muted">{t.review.pharmacistModeHint}</p>}

          <AttentionBar count={remaining} onJump={jumpToFirst} />
        </header>

        {sections.map((sec) => {
          const fields = TOP_FIELDS.filter((f) => f.section === sec.key && isVisible(f.path, pharmacist));
          return (
            <Section key={sec.key} title={sec.title}>
              <div className="grid gap-1 sm:grid-cols-2">
                {fields.map((f) => {
                  const field = getTop(rx, f.path);
                  const label = f.path === "prescription_date" ? t.review.fields.prescription_date : t.review.fields[f.key as keyof typeof t.review.fields];
                  const wide = ["clinical.diagnosis_or_complaints", "clinical.other_advice", "doctor.address", "patient.address"].includes(f.path);
                  return (
                    <div key={f.path} className={wide ? "sm:col-span-2" : ""}>
                      <FieldRow
                        id={f.path}
                        label={label}
                        flag={state.flags[f.path]}
                        confirmed={state.confirmed.includes(f.path)}
                        onConfirm={() => confirm(f.path)}
                        aiConfidence={pharmacist && field.value ? field.confidence : undefined}
                      >
                        <TextInput
                          id={f.path}
                          value={field.value}
                          multiline={wide}
                          onChange={(v) => setState((s) => s && { ...s, rx: setTop(s.rx, f.path, v), confirmed: s.confirmed.includes(f.path) ? s.confirmed : [...s.confirmed, f.path] })}
                        />
                      </FieldRow>
                    </div>
                  );
                })}
                {sec.key === "clinical" && (
                  <div className="sm:col-span-2">
                    <FieldRow id="clinical.tests_advised" label={t.review.fields.tests_advised} confirmed onConfirm={() => {}} hint={t.review.fields.testsHint}>
                      <TextInput
                        id="clinical.tests_advised"
                        multiline
                        value={rx.clinical.tests_advised.join("\n") || null}
                        onChange={(v) =>
                          setState((s) => s && { ...s, rx: { ...s.rx, clinical: { ...s.rx.clinical, tests_advised: (v ?? "").split("\n").map((x) => x.trim()).filter(Boolean) } } })
                        }
                      />
                    </FieldRow>
                  </div>
                )}
              </div>
            </Section>
          );
        })}

        <Section title={`${t.review.sections.medicines} (${state.meds.length})`} bare>
          <ol className="space-y-4">
            {state.meds.map((med, i) => (
              <MedicineEditor
                key={med.id}
                index={i}
                med={med}
                flags={state.flags}
                confirmed={state.confirmed}
                pharmacist={pharmacist}
                onConfirm={confirm}
                onChange={(data, key) =>
                  setState((s) => {
                    if (!s) return s;
                    const path = `${med.id}.${key}`;
                    return {
                      ...s,
                      meds: s.meds.map((m) => (m.id === med.id ? { ...m, data } : m)),
                      confirmed: s.confirmed.includes(path) ? s.confirmed : [...s.confirmed, path],
                    };
                  })
                }
                onNote={(note) => setState((s) => s && { ...s, meds: s.meds.map((m) => (m.id === med.id ? { ...m, note } : m)) })}
                onRemove={() => setState((s) => s && { ...s, meds: s.meds.filter((m) => m.id !== med.id) })}
              />
            ))}
          </ol>
          <button
            type="button"
            onClick={() => setState((s) => s && { ...s, meds: [...s.meds, newReviewMed()] })}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand/50 font-semibold text-brand hover:bg-card"
          >
            <PlusIcon className="size-5" />
            {t.review.med.add}
          </button>
        </Section>

        {unmatched.length > 0 && (
          <Section title={t.review.sections.unreadable}>
            <div id="unreadable-section" className="space-y-2 p-3">
              <p className="text-sm text-muted">{t.review.unreadableHint}</p>
              {unmatched.map((u) => (
                <label key={u.i} className={`flex items-start gap-3 rounded-lg p-2 ${u.done ? "" : "bg-amber-50"}`}>
                  <input
                    type="checkbox"
                    checked={u.done}
                    onChange={(e) => setState((s) => s && { ...s, unreadable: s.unreadable.map((x, j) => (j === u.i ? { ...x, done: e.target.checked } : x)) })}
                    className="mt-1 size-5 shrink-0 accent-[var(--brand)]"
                  />
                  <span>
                    <bdi dir="ltr" className="latin">{u.text}</bdi>
                    <span className="block text-xs text-muted">{t.review.markChecked}</span>
                  </span>
                </label>
              ))}
            </div>
          </Section>
        )}

        {pharmacist && (
          <Section title={t.review.generalNotes}>
            <div className="p-3">
              <textarea
                aria-label={t.review.generalNotes}
                dir="auto"
                rows={3}
                value={state.generalNote}
                onChange={(e) => setState((s) => s && { ...s, generalNote: e.target.value })}
                className="w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base"
              />
            </div>
          </Section>
        )}

        <div className="space-y-3 border-t border-line pt-6">
          {remaining > 0 && (
            <p className="flex gap-2 text-sm text-amber-800">
              <AlertIcon className="mt-0.5 size-4 shrink-0" />
              {fmt(t.review.remaining, { n: remaining })}
            </p>
          )}
          <button type="button" onClick={finish} className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-lg font-bold text-white hover:bg-emerald-800">
            <CheckIcon className="size-6" />
            {t.review.continue}
          </button>
          <Link href="/scan" className="block py-2 text-center text-brand underline underline-offset-4">
            {t.review.scanAgain}
          </Link>
        </div>
      </div>

      {/* Phones: a button that's always reachable to look at the photo */}
      {scan.images.length > 0 && (
        <button
          type="button"
          onClick={() => setPhotoOpen(true)}
          className="fixed start-4 z-40 flex min-h-12 items-center gap-2 rounded-full bg-brand px-5 font-semibold text-white shadow-lg shadow-black/25 lg:hidden"
          style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          📄 {t.review.viewPhoto}
        </button>
      )}
      {photoOpen && <PhotoViewer images={scan.images} onClose={() => setPhotoOpen(false)} />}

      <datalist id="dosage-forms">
        {["tablet", "capsule", "syrup", "suspension", "drops", "injection", "ointment", "cream", "gel", "inhaler", "sachet", "suppository", "gargle", "spray"].map((o) => <option key={o} value={o} />)}
      </datalist>
      <datalist id="routes">
        {["oral", "topical", "eye", "ear", "nasal", "inhaled", "injection", "rectal", "vaginal", "under the tongue"].map((o) => <option key={o} value={o} />)}
      </datalist>
    </div>
  );
}

function AttentionBar({ count, onJump }: { count: number; onJump: () => void }) {
  const { t } = useI18n();
  if (count === 0) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
        <CheckIcon className="size-5" />
        {t.review.attentionNone}
      </p>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-3" role="status">
      <p className="flex items-center gap-2 font-semibold text-amber-900">
        <AlertIcon className="size-5 shrink-0" />
        {fmt(t.review.attention, { n: count })}
      </p>
      <button type="button" onClick={onJump} className="min-h-10 shrink-0 rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white">
        {t.review.jumpToFirst}
      </button>
    </div>
  );
}

function Section({ title, children, bare }: { title: string; children: ReactNode; bare?: boolean }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-bold text-brand">{title}</h2>
      {bare ? children : <div className="rounded-2xl border border-line bg-card p-1">{children}</div>}
    </section>
  );
}
