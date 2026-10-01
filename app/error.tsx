"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useI18n } from "@/components/I18nProvider";
import { AlertIcon } from "@/components/icons";

/** Shown if a page crashes. The header, footer and language stay in place. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    // Only the kind of error, never page content (which could include prescription details).
    console.error("[page error]", error.name, error.digest ?? "");
  }, [error]);
  return (
    <div className="mx-auto max-w-2xl px-4 pt-10">
      <div className="rounded-2xl border border-line bg-card p-6" role="alert">
        <p className="flex items-center gap-2 text-xl font-bold text-ink"><AlertIcon className="size-6 text-amber-700" />{t.errors.title}</p>
        <p className="mt-2 text-muted">{t.errors.text}</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={reset} className="min-h-12 flex-1 rounded-xl bg-brand px-5 font-semibold text-white">{t.errors.retry}</button>
          <Link href="/" className="flex min-h-12 flex-1 items-center justify-center rounded-xl border-2 border-brand px-5 font-semibold text-brand">{t.errors.home}</Link>
        </div>
      </div>
    </div>
  );
}
