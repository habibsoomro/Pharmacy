"use client";

import { useI18n } from "@/components/I18nProvider";
import { CheckIcon, SpinnerIcon } from "@/components/icons";

/** Progress list shown while the prescription is being read. `upTo` limits which steps are shown. */
export function LoadingSteps({ current, upTo }: { current: number; upTo?: number }) {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border border-line bg-card p-5" role="status" aria-live="polite">
      <h2 className="mb-4 text-lg font-semibold text-brand">{t.scan.loading.title}</h2>
      <ol className="space-y-3">
        {t.scan.loading.steps.slice(0, upTo).map((step, i) => {
          const state = i < current ? "done" : i === current ? "active" : "todo";
          return (
            <li key={step} className={`flex items-center gap-3 ${state === "todo" ? "text-muted/60" : ""}`}>
              <span className={`grid size-7 shrink-0 place-items-center rounded-full ${state === "done" ? "bg-emerald-600 text-white" : state === "active" ? "text-brand" : "border-2 border-line"}`}>
                {state === "done" && <CheckIcon className="size-4" />}
                {state === "active" && <SpinnerIcon className="size-6" />}
              </span>
              <span className={state === "active" ? "font-semibold" : ""}>{step}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
