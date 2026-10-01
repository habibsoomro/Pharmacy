import type { ReactNode } from "react";

/** Simple wrapper for inner pages: a heading and content. */
export function PageShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-8">
      <h1 className="text-2xl font-bold text-brand sm:text-3xl">{title}</h1>
      <div className="mt-4 space-y-4 text-base">{children}</div>
    </div>
  );
}
