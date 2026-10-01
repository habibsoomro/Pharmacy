"use client";

import { useState, type ReactNode } from "react";
import { useI18n } from "@/components/I18nProvider";
import { CheckIcon, WhatsAppIcon } from "@/components/icons";

export function whatsappShare(text: string) {
  const max = 3800; // long links can fail on some phones
  const body = text.length > max ? `${text.slice(0, max)}…` : text;
  window.open(`https://wa.me/?text=${encodeURIComponent(body)}`, "_blank", "noopener");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older phones: fall back to a hidden text box.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

/** One summary box: emoji icon, heading, Copy and WhatsApp buttons. */
export function SummaryCard({ id, icon, title, text, tone = "plain", children }: {
  id: string; icon: string; title: string; text?: () => string; tone?: "plain" | "danger"; children: ReactNode;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <section id={`card-${id}`} data-card={id} aria-labelledby={`card-${id}-title`}
      className={`break-inside-avoid rounded-2xl border ${tone === "danger" ? "border-red-300 bg-red-50/60" : "border-line bg-card"}`}>
      <div className="flex items-center justify-between gap-2 border-b border-line/70 px-4 py-3">
        <h2 id={`card-${id}-title`} className="flex items-center gap-2 text-lg font-bold text-ink">
          <span aria-hidden="true">{icon}</span>
          <bdi>{title}</bdi>
        </h2>
        {text && (
          <div className="no-print flex shrink-0 gap-1">
            <button type="button" aria-label={`${t.summary.actions.copy}: ${title}`}
              onClick={async () => { if (await copyText(text())) { setCopied(true); setTimeout(() => setCopied(false), 2000); } }}
              className="flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted hover:bg-surface">
              {copied ? <CheckIcon className="size-4 text-emerald-700" /> : <CopyIcon />}
              <span className="hidden sm:inline">{copied ? t.summary.actions.copied : t.summary.actions.copy}</span>
            </button>
            <button type="button" aria-label={`${t.summary.actions.whatsapp}: ${title}`} onClick={() => whatsappShare(text())}
              className="flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-whatsapp hover:bg-surface">
              <WhatsAppIcon className="size-4" />
            </button>
          </div>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </svg>
  );
}

/** A label + value row; hidden when there is no value. */
export function InfoRow({ label, children, ltr }: { label: string; children: ReactNode; ltr?: boolean }) {
  if (children === null || children === undefined || children === "" || children === false) return null;
  return (
    <div className="flex flex-wrap gap-x-2 py-1">
      <dt className="text-muted">{label}:</dt>
      <dd className="font-medium">{ltr ? <bdi dir="ltr" className="latin">{children}</bdi> : children}</dd>
    </div>
  );
}
