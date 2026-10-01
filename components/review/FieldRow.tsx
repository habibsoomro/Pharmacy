"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/components/I18nProvider";
import { fmtNode } from "@/lib/format-node";
import type { Confidence } from "@/lib/schemas/extraction";
import type { Flag } from "@/lib/rx/review";
import { AlertIcon, CheckIcon } from "@/components/icons";

type Props = {
  id: string; // also the field's path, used by "Show me"
  label: string;
  flag?: Flag;
  confirmed: boolean;
  onConfirm: () => void;
  currentValue?: string | null;
  onUseSuggestion?: (value: string) => void;
  aiConfidence?: Confidence; // shown in pharmacist mode
  hint?: string;
  children: ReactNode; // the input
};

/** One labelled field. Turns amber with ⚠ when it needs checking. */
export function FieldRow({ id, label, flag, confirmed, onConfirm, currentValue, onUseSuggestion, aiConfidence, hint, children }: Props) {
  const { t } = useI18n();
  const needs = !!flag && !confirmed;
  const suggestion = flag?.suggestion;
  const showSuggestion = needs && suggestion && onUseSuggestion && suggestion !== currentValue;

  return (
    <div
      id={`field-${id}`}
      data-attention={needs ? "true" : undefined}
      className={`rounded-xl px-3 py-2 ${needs ? "border-2 border-amber-400 bg-amber-50" : "border border-transparent"}`}
    >
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2">
        <label htmlFor={`input-${id}`} className="text-sm font-medium text-muted">
          {needs && <AlertIcon className="me-1 inline size-4 align-[-2px] text-amber-700" />}
          {label}
        </label>
        {aiConfidence && (
          <span className={`text-xs ${aiConfidence === "low" ? "text-amber-800" : "text-muted"}`}>
            {fmtNode(t.review.flag.ai, { c: t.review.confidence[aiConfidence] })}
          </span>
        )}
      </div>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}

      {showSuggestion && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span>{fmtNode(t.review.flag.suggestion, { value: suggestion })}</span>
          <button type="button" onClick={() => onUseSuggestion(suggestion)} className="min-h-9 rounded-lg bg-brand px-3 font-semibold text-white">
            {t.review.flag.useSuggestion}
          </button>
        </div>
      )}

      {needs ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-amber-800">{t.review.flag.needsCheck}</span>
          <button type="button" onClick={onConfirm} className="flex min-h-10 items-center gap-1.5 rounded-lg border-2 border-emerald-700 bg-white px-3 text-sm font-semibold text-emerald-800">
            <CheckIcon className="size-4" />
            {t.review.flag.looksRight}
          </button>
        </div>
      ) : flag && confirmed ? (
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-700">
          <CheckIcon className="size-3.5" />
          {t.review.flag.confirmed}
        </p>
      ) : null}
    </div>
  );
}

const inputBase = "w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base focus:border-brand focus:outline-none focus-visible:outline-2 focus-visible:outline-brand";

/** Text box. English medicine data uses `ltr` so it isn't flipped in Urdu/Sindhi. */
export function TextInput({ id, value, onChange, ltr, multiline, list, placeholder }: {
  id: string; value: string | null; onChange: (v: string | null) => void; ltr?: boolean; multiline?: boolean; list?: string; placeholder?: string;
}) {
  const common = {
    id: `input-${id}`,
    value: value ?? "",
    placeholder,
    dir: ltr ? "ltr" : "auto",
    className: `${inputBase} ${ltr ? "latin" : ""}`,
  } as const;
  return multiline ? (
    <textarea {...common} rows={2} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)} />
  ) : (
    <input {...common} type="text" list={list} autoComplete="off" onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)} />
  );
}

export function NumberInput({ id, value, onChange, min = 0, max = 365 }: { id: string; value: number | null; onChange: (v: number | null) => void; min?: number; max?: number }) {
  return (
    <input
      id={`input-${id}`}
      type="number"
      inputMode="decimal"
      dir="ltr"
      min={min}
      max={max}
      step="any"
      value={value ?? ""}
      onChange={(e) => {
        const n = e.target.value === "" ? null : Number(e.target.value);
        onChange(n === null || Number.isNaN(n) ? null : Math.min(max, Math.max(min, n)));
      }}
      className={`${inputBase} latin max-w-36`}
    />
  );
}
