"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/components/I18nProvider";
import { fmt } from "@/lib/format";
import { hasProblem, type QualityReport } from "@/lib/image/quality";
import { AlertIcon, CheckIcon, CropIcon, RetakeIcon, RotateIcon, TrashIcon } from "@/components/icons";

type Props = {
  index: number;
  previewUrl: string;
  quality: QualityReport;
  onView: () => void;
  onRotate: () => void;
  onCrop: () => void;
  onRetake: () => void;
  onRemove: () => void;
};

export function PageCard({ index, previewUrl, quality, onView, onRotate, onCrop, onRetake, onRemove }: Props) {
  const { t } = useI18n();
  const q = t.scan.quality;
  const problems: { title: string; tip: string }[] = [];
  if (quality.tooDark) problems.push({ title: q.tooDark, tip: q.tooDarkTip });
  if (quality.blurry) problems.push({ title: q.blurry, tip: q.blurryTip });
  if (quality.tooSmall) problems.push({ title: q.tooSmall, tip: q.tooSmallTip });

  return (
    <li className="overflow-hidden rounded-2xl border border-line bg-card" data-brightness={quality.brightness} data-sharpness={quality.sharpness}>
      <div className="flex gap-4 p-3">
        <button type="button" onClick={onView} className="shrink-0" aria-label={`${t.scan.viewLarger}: ${fmt(t.scan.pageLabel, { n: index + 1 })}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="" className="h-28 w-22 rounded-lg border border-line bg-surface object-cover sm:h-36 sm:w-28" />
        </button>

        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{fmt(t.scan.pageLabel, { n: index + 1 })}</h3>
          {hasProblem(quality) ? (
            <div className="mt-1 space-y-1.5 text-sm" role="status">
              {problems.map((p) => (
                <div key={p.title}>
                  <p className="flex items-center gap-1.5 font-semibold text-amber-800">
                    <AlertIcon className="size-4 shrink-0" />
                    {p.title}
                  </p>
                  <p className="text-muted">{p.tip}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-emerald-700" role="status">
              <CheckIcon className="size-4" />
              {q.good}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 border-t border-line text-xs sm:text-sm">
        <Action onClick={onRotate} icon={<RotateIcon className="size-5" />} label={t.scan.rotate} />
        <Action onClick={onCrop} icon={<CropIcon className="size-5" />} label={t.scan.crop} />
        <Action onClick={onRetake} icon={<RetakeIcon className="size-5" />} label={t.scan.retake} />
        <Action onClick={onRemove} icon={<TrashIcon className="size-5" />} label={t.scan.remove} danger />
      </div>
    </li>
  );
}

function Action({ onClick, icon, label, danger }: { onClick: () => void; icon: ReactNode; label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-14 flex-col items-center justify-center gap-0.5 border-line hover:bg-surface [&:not(:first-child)]:border-s ${danger ? "text-red-700" : "text-ink"}`}
    >
      {icon}
      {label}
    </button>
  );
}
