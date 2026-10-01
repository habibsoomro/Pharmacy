"use client";

import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { fmt } from "@/lib/format";
import { CloseIcon, PlusIcon } from "@/components/icons";

const ZOOMS = [1, 1.5, 2, 3];

/** The original prescription photo, with page tabs and zoom, for comparing. */
export function PhotoPane({ images, className = "" }: { images: { mediaType: string; base64: string }[]; className?: string }) {
  const { t } = useI18n();
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(0);
  const img = images[page];

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
        {images.length > 1 ? (
          <div className="flex gap-1" role="tablist">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === page}
                onClick={() => setPage(i)}
                className={`min-h-9 rounded-full px-3 text-sm ${i === page ? "bg-brand text-white" : "bg-surface text-ink"}`}
              >
                {fmt(t.review.page, { n: i + 1 })}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <div className="flex gap-1">
          <button type="button" onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0} aria-label={t.review.zoomOut}
            className="grid size-9 place-items-center rounded-full bg-surface text-lg font-bold disabled:opacity-40">−</button>
          <button type="button" onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoom === ZOOMS.length - 1} aria-label={t.review.zoomIn}
            className="grid size-9 place-items-center rounded-full bg-surface disabled:opacity-40"><PlusIcon className="size-4" /></button>
        </div>
      </div>
      {/* dir="ltr" so scrolling a zoomed photo starts at the left edge in Urdu/Sindhi too. */}
      <div dir="ltr" className="min-h-0 flex-1 overflow-auto rounded-xl border border-line bg-surface">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`data:${img.mediaType};base64,${img.base64}`} alt={t.review.photoTitle} style={{ width: `${ZOOMS[zoom] * 100}%`, maxWidth: "none" }} className="block" />
        ) : null}
      </div>
    </div>
  );
}

/** Full-screen version for phones. */
export function PhotoViewer({ images, onClose }: { images: { mediaType: string; base64: string }[]; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div role="dialog" aria-modal="true" aria-label={t.review.photoTitle} className="fixed inset-0 z-50 flex flex-col bg-card p-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
      <div className="flex items-center justify-between pb-2">
        <h2 className="font-semibold">{t.review.photoTitle}</h2>
        <button type="button" onClick={onClose} aria-label={t.review.close} className="grid size-11 place-items-center rounded-full bg-surface">
          <CloseIcon className="size-6" />
        </button>
      </div>
      <PhotoPane images={images} className="flex-1" />
    </div>
  );
}
