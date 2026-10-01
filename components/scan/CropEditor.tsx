"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as RPE } from "react";
import { useI18n } from "@/components/I18nProvider";
import type { CropRect } from "@/lib/image/canvas";

type Handle = "nw" | "ne" | "sw" | "se" | "move";
const FULL: CropRect = { x: 0, y: 0, w: 1, h: 1 };
const MIN = 0.1;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Drag the corners (or the middle) of the box to choose what to keep. */
export function CropEditor({ canvas, onApply, onCancel }: { canvas: HTMLCanvasElement; onApply: (r: CropRect) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const src = useMemo(() => canvas.toDataURL("image/jpeg", 0.8), [canvas]);
  const [rect, setRect] = useState<CropRect>(FULL);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ handle: Handle; startX: number; startY: number; start: CropRect } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function down(handle: Handle) {
    return (e: RPE) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as Element).setPointerCapture(e.pointerId);
      drag.current = { handle, startX: e.clientX, startY: e.clientY, start: rect };
    };
  }

  function move(e: RPE) {
    const d = drag.current;
    const box = boxRef.current?.getBoundingClientRect();
    if (!d || !box) return;
    const dx = (e.clientX - d.startX) / box.width;
    const dy = (e.clientY - d.startY) / box.height;
    const s = d.start;
    let { x, y, w, h } = s;
    if (d.handle === "move") {
      x = clamp(s.x + dx, 0, 1 - s.w);
      y = clamp(s.y + dy, 0, 1 - s.h);
    } else {
      if (d.handle.includes("w")) { x = clamp(s.x + dx, 0, s.x + s.w - MIN); w = s.x + s.w - x; }
      if (d.handle.includes("e")) { w = clamp(s.w + dx, MIN, 1 - s.x); }
      if (d.handle.includes("n")) { y = clamp(s.y + dy, 0, s.y + s.h - MIN); h = s.y + s.h - y; }
      if (d.handle.includes("s")) { h = clamp(s.h + dy, MIN, 1 - s.y); }
    }
    setRect({ x, y, w, h });
  }

  const up = () => { drag.current = null; };
  const pct = (v: number) => `${v * 100}%`;
  const corners: { h: Handle; style: React.CSSProperties; cursor: string }[] = [
    { h: "nw", style: { left: 0, top: 0 }, cursor: "nwse-resize" },
    { h: "ne", style: { right: 0, top: 0 }, cursor: "nesw-resize" },
    { h: "sw", style: { left: 0, bottom: 0 }, cursor: "nesw-resize" },
    { h: "se", style: { right: 0, bottom: 0 }, cursor: "nwse-resize" },
  ];

  return (
    <div role="dialog" aria-modal="true" aria-label={t.scan.cropper.title} className="fixed inset-0 z-50 flex flex-col bg-[#0f1626] text-white">
      <div className="px-4 pt-4 text-center">
        <h2 className="text-lg font-semibold">{t.scan.cropper.title}</h2>
        <p className="text-sm text-white/80">{t.scan.cropper.hint}</p>
      </div>

      {/* dir="ltr" so dragging left/right works the same in Urdu and Sindhi. */}
      <div dir="ltr" className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div ref={boxRef} className="relative touch-none select-none" onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" draggable={false} className="block max-h-[62dvh] max-w-full" />
          {/* Dark shade outside the crop box (clipped to the photo). */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="absolute shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
              style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) }}
            />
          </div>
          {/* The box itself, with corner handles that may sit over the photo edge. */}
          <div
            onPointerDown={down("move")}
            className="absolute cursor-move border-2 border-white"
            style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) }}
          >
            {corners.map((c) => (
              <span
                key={c.h}
                onPointerDown={down(c.h)}
                className="absolute -m-5 grid size-10 place-items-center"
                style={{ ...c.style, cursor: c.cursor }}
              >
                <span className="size-5 rounded-full border-2 border-brand bg-white shadow" />
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 px-4 pt-2" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <button type="button" onClick={onCancel} className="min-h-12 rounded-xl px-4 text-white/90 underline underline-offset-4">
          {t.scan.cropper.cancel}
        </button>
        <button type="button" onClick={() => setRect(FULL)} className="min-h-12 rounded-xl border border-white/50 px-4">
          {t.scan.cropper.reset}
        </button>
        <button type="button" onClick={() => onApply(rect)} className="min-h-12 rounded-xl bg-white px-5 font-semibold text-brand">
          {t.scan.cropper.apply}
        </button>
      </div>
    </div>
  );
}
