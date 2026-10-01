"use client";

import { useI18n } from "@/components/I18nProvider";
import { fmt } from "@/lib/format";
import { computeTotal } from "@/lib/rx/checks";
import { MED_FIELDS, isVisible, medPath, updateMed, type Flag, type MedKey, type ReviewMed } from "@/lib/rx/review";
import { FoodTiming, type Medicine } from "@/lib/schemas/extraction";
import { FieldRow, NumberInput, TextInput } from "@/components/review/FieldRow";
import { TrashIcon } from "@/components/icons";

type Props = {
  index: number;
  med: ReviewMed;
  flags: Record<string, Flag>;
  confirmed: string[];
  pharmacist: boolean;
  onChange: (data: Medicine, touched: MedKey) => void;
  onConfirm: (path: string) => void;
  onNote: (note: string) => void;
  onRemove: () => void;
};

// English text fields: keep left-to-right even on Urdu/Sindhi pages.
const LTR: MedKey[] = ["brand_name", "generic_name", "strength", "dose_per_time", "frequency_text", "duration_text", "total_quantity_needed", "dosage_form", "route"];
const SLOTS = ["morning", "afternoon", "evening", "night"] as const;

export function MedicineEditor({ index, med, flags, confirmed, pharmacist, onChange, onConfirm, onNote, onRemove }: Props) {
  const { t } = useI18n();
  const m = med.data;
  const L = t.review.med;
  const name = m.brand_name ?? m.generic_name ?? L.unnamed;

  const set = (key: MedKey, value: unknown) => onChange(updateMed(m, key, value), key);

  function input(key: MedKey) {
    const id = medPath(med.id, key);
    switch (key) {
      case "times_per_day":
      case "duration_days":
        return <NumberInput id={id} value={m[key]} onChange={(v) => set(key, v)} max={key === "times_per_day" ? 24 : 3650} />;
      case "schedule":
        return (
          <div className="grid grid-cols-4 gap-2">
            {SLOTS.map((slot) => (
              <label key={slot} className="flex flex-col items-center gap-1 text-xs text-muted">
                {L[slot]}
                <input
                  id={slot === "morning" ? `input-${id}` : undefined}
                  type="number"
                  inputMode="decimal"
                  dir="ltr"
                  min={0}
                  max={20}
                  step={0.5}
                  value={m.schedule[slot]}
                  onChange={(e) => set("schedule", { ...m.schedule, [slot]: Math.max(0, Number(e.target.value) || 0) })}
                  className="latin w-full rounded-lg border border-line bg-card px-2 py-2 text-center text-base"
                />
              </label>
            ))}
          </div>
        );
      case "food_timing":
        return (
          <select
            id={`input-${id}`}
            value={m.food_timing ?? ""}
            onChange={(e) => set("food_timing", e.target.value === "" ? null : e.target.value)}
            className="w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base"
          >
            <option value="">{t.review.food.notWritten}</option>
            {FoodTiming.options.map((o) => (
              <option key={o} value={o}>{t.review.food[o]}</option>
            ))}
          </select>
        );
      case "total_quantity_needed": {
        const calc = computeTotal(m);
        return (
          <div className="flex gap-2">
            <TextInput id={id} value={m.total_quantity_needed} onChange={(v) => set(key, v)} ltr />
            <button
              type="button"
              disabled={!calc}
              onClick={() => calc && set(key, calc)}
              className="shrink-0 rounded-lg border-2 border-brand px-3 text-sm font-semibold text-brand disabled:border-line disabled:text-muted"
            >
              {L.calculate}
            </button>
          </div>
        );
      }
      case "dosage_form":
        return <TextInput id={id} value={m.dosage_form} onChange={(v) => set(key, v)} ltr list="dosage-forms" />;
      case "route":
        return <TextInput id={id} value={m.route} onChange={(v) => set(key, v)} ltr list="routes" />;
      case "special_instructions":
      case "purpose_in_simple_words":
        return <TextInput id={id} value={m[key]} onChange={(v) => set(key, v)} multiline />;
      default:
        return <TextInput id={id} value={m[key] as string | null} onChange={(v) => set(key, v)} ltr={LTR.includes(key)} />;
    }
  }

  return (
    <li className={`rounded-2xl border bg-card ${m.confidence === "low" ? "border-amber-300" : "border-line"}`}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h3 className="min-w-0 font-semibold">
          {fmt(L.title, { n: index + 1 })}
          <span className="text-muted"> · </span>
          <bdi dir="ltr" className="latin">{name}</bdi>
          {pharmacist && (
            <span className={`ms-2 rounded-full px-2 py-0.5 text-xs ${m.confidence === "low" ? "bg-amber-100 text-amber-900" : "bg-surface text-muted"}`}>
              {t.review.confidence[m.confidence]}
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={() => window.confirm(L.removeConfirm) && onRemove()}
          className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-red-700 hover:bg-red-50"
        >
          <TrashIcon className="size-4" />
          {L.remove}
        </button>
      </div>

      <div className="grid gap-1 p-2 sm:grid-cols-2">
        {MED_FIELDS.filter((f) => isVisible(medPath(med.id, f.key), pharmacist)).map((f) => {
          const path = medPath(med.id, f.key);
          const wide = ["schedule", "special_instructions", "purpose_in_simple_words", "frequency_text", "total_quantity_needed"].includes(f.key);
          return (
            <div key={f.key} className={wide ? "sm:col-span-2" : ""}>
              <FieldRow
                id={path}
                label={L[f.key]}
                flag={flags[path]}
                confirmed={confirmed.includes(path)}
                onConfirm={() => onConfirm(path)}
                currentValue={m[f.key] === null ? null : String(m[f.key])}
                onUseSuggestion={(v) => set(f.key, f.key === "times_per_day" || f.key === "duration_days" ? Number(v.match(/\d+(\.\d+)?/)?.[0]) : v)}
                hint={f.key === "frequency_text" ? L.frequencyHint : undefined}
              >
                {input(f.key)}
              </FieldRow>
            </div>
          );
        })}

        {pharmacist && (
          <div className="p-3 sm:col-span-2">
            <label htmlFor={`note-${med.id}`} className="mb-1 block text-sm font-medium text-muted">{L.notes}</label>
            <textarea
              id={`note-${med.id}`}
              dir="auto"
              rows={2}
              value={med.note}
              onChange={(e) => onNote(e.target.value)}
              className="w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base"
            />
          </div>
        )}
      </div>
    </li>
  );
}
