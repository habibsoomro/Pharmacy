"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { CAPTURE } from "@/config/capture";
import { fmt } from "@/lib/format";
import { crop, rotate90, scaleTo, toJpegBlob, type CropRect } from "@/lib/image/canvas";
import { ImageLoadError, loadFile, type LoadError } from "@/lib/image/load";
import { checkQuality, hasProblem, type QualityReport } from "@/lib/image/quality";
import { prepareForUpload } from "@/lib/image/prepare";
import { requestExtraction, type ClientErrorCode } from "@/lib/client/extract";
import { hasConsent, saveConsent } from "@/lib/client/consent";
import { saveCurrentScan } from "@/lib/client/scan-session";
import { ConsentBox } from "@/components/scan/ConsentBox";
import { LoadingSteps } from "@/components/scan/LoadingSteps";
import { CameraCapture } from "@/components/scan/CameraCapture";
import { CropEditor } from "@/components/scan/CropEditor";
import { PageCard } from "@/components/scan/PageCard";
import { AlertIcon, CameraIcon, CloseIcon, PlusIcon, SpinnerIcon, UploadIcon } from "@/components/icons";

type Page = {
  id: string;
  canvas: HTMLCanvasElement; // working copy used for rotate / crop
  originalShortSide: number;
  previewUrl: string;
  quality: QualityReport;
};

const CAMERA_APP_INPUT = "camera-app-input";
let nextId = 0;

async function makePreview(canvas: HTMLCanvasElement): Promise<string> {
  return URL.createObjectURL(await toJpegBlob(scaleTo(canvas, 1200), 0.8));
}

export function ScanFlow() {
  const { t } = useI18n();
  const [pages, setPages] = useState<Page[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [replaceAt, setReplaceAt] = useState<number | null>(null); // which page "Retake" replaces
  const [cropIndex, setCropIndex] = useState<number | null>(null);
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const router = useRouter();
  const [phase, setPhase] = useState<"capture" | "reading">("capture");
  const [step, setStep] = useState(0);
  const [apiError, setApiError] = useState<ClientErrorCode | null>(null);
  const [notRx, setNotRx] = useState(false);
  const [consent, setConsent] = useState(false);
  const [consentAsked, setConsentAsked] = useState(true); // hide the box for people who already agreed
  const [consentError, setConsentError] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraAppRef = useRef<HTMLInputElement>(null);

  // Free memory used by previews when leaving the page.
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  useEffect(() => () => pagesRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl)), []);

  useEffect(() => {
    const agreed = hasConsent();
    setConsent(agreed);
    setConsentAsked(agreed);
  }, []);

  /** Any change to the photos clears the old reading result. */
  const resetResult = () => {
    setApiError(null);
    setNotRx(false);
  };

  const full = pages.length >= CAPTURE.maxPages;

  const errorText = useCallback(
    (code: LoadError) => fmt(t.scan.errors[code], { mb: CAPTURE.maxInputFileMB }),
    [t],
  );

  /** Open files/photos and add them as pages (or replace one page for "Retake"). */
  async function addFiles(files: (File | Blob)[], replaceIndex: number | null) {
    if (!files.length) return;
    setError(null);
    resetResult();
    setBusy(true);
    try {
      for (const file of files) {
        const room = replaceIndex !== null || pagesRef.current.length < CAPTURE.maxPages;
        if (!room) {
          setError(fmt(t.scan.maxPagesReached, { max: CAPTURE.maxPages }));
          break;
        }
        try {
          const loaded = await loadFile(file);
          const shortSide = Math.min(loaded.originalWidth, loaded.originalHeight);
          const page: Page = {
            id: `p${nextId++}`,
            canvas: loaded.canvas,
            originalShortSide: shortSide,
            previewUrl: await makePreview(loaded.canvas),
            quality: checkQuality(loaded.canvas, shortSide),
          };
          // Copy the target now: React runs the update below later, after replaceIndex is cleared.
          const target = replaceIndex;
          setPages((prev) => {
            if (target !== null && prev[target]) {
              URL.revokeObjectURL(prev[target].previewUrl);
              const copy = [...prev];
              copy[target] = page;
              return copy;
            }
            return [...prev, page];
          });
          if (target === null) pagesRef.current = [...pagesRef.current, page];
          replaceIndex = null; // only the first file replaces; any extra files are added
        } catch (e) {
          setError(e instanceof ImageLoadError ? errorText(e.code) : t.scan.errors.readFailed);
        }
      }
    } finally {
      setBusy(false);
      setReplaceAt(null);
    }
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // so picking the same file again still works
    addFiles(files, replaceAt);
  }

  function openCamera(forIndex: number | null) {
    setReplaceAt(forIndex);
    const canUseLiveCamera = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;
    if (canUseLiveCamera) setCameraOpen(true);
    else cameraAppRef.current?.click(); // older phones / non-HTTPS: phone's own camera app
  }

  async function updatePage(index: number, change: (c: HTMLCanvasElement) => HTMLCanvasElement, recheckSize = false) {
    resetResult();
    const old = pages[index];
    const canvas = change(old.canvas);
    // After cropping, the useful part of the photo is smaller, so re-check "too small".
    const shortSide = recheckSize
      ? Math.round(old.originalShortSide * (Math.min(canvas.width, canvas.height) / Math.min(old.canvas.width, old.canvas.height)))
      : old.originalShortSide;
    const page: Page = { ...old, canvas, originalShortSide: shortSide, previewUrl: await makePreview(canvas), quality: checkQuality(canvas, shortSide) };
    URL.revokeObjectURL(old.previewUrl);
    setPages((prev) => prev.map((p, i) => (i === index ? page : p)));
  }

  function removePage(index: number) {
    resetResult();
    URL.revokeObjectURL(pages[index].previewUrl);
    setPages((prev) => prev.filter((_, i) => i !== index));
  }

  async function onContinue() {
    if (!consent) {
      setConsentError(true);
      return;
    }
    saveConsent(true);
    resetResult();
    setError(null);
    setPhase("reading");
    setStep(0);
    window.scrollTo({ top: 0 });
    // The first steps happen inside one AI request, so we move the progress on a timer.
    const timer = window.setTimeout(() => setStep(1), 5000);
    try {
      const images = await Promise.all(pages.map((p) => prepareForUpload(p.canvas)));
      const res = await requestExtraction(images);
      if (!res.ok) {
        setApiError(res.error);
        setPhase("capture");
        return;
      }
      if (!res.result.is_prescription) {
        setNotRx(true);
        setPhase("capture");
        return;
      }
      setStep(2);
      saveCurrentScan({
        createdAt: new Date().toISOString(),
        result: res.result,
        checks: res.checks,
        images: images.map((i) => ({ mediaType: i.mediaType, base64: i.base64 })),
      });
      router.push("/review");
    } catch {
      setApiError("ai_failed");
      setPhase("capture");
    } finally {
      window.clearTimeout(timer);
    }
  }

  const anyProblem = pages.some((p) => hasProblem(p.quality));

  // Only reading happens here; the interaction check runs after the person has checked the result.
  if (phase === "reading") return <LoadingSteps current={step} upTo={2} />;

  return (
    <div className="space-y-6">
      <p className="text-muted">{fmt(t.scan.intro, { max: CAPTURE.maxPages })}</p>

      {/* Hidden file pickers */}
      <input ref={uploadRef} type="file" accept="image/*,.heic,.heif,application/pdf,.pdf" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onPick} />
      <input
        ref={cameraAppRef}
        id={CAMERA_APP_INPUT}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          setCameraOpen(false);
          onPick(e);
        }}
      />

      {pages.length > 0 && (
        <section aria-live="polite">
          <p className="mb-3 text-sm font-medium text-muted">{fmt(t.scan.pagesCount, { n: pages.length, max: CAPTURE.maxPages })}</p>
          <ol className="space-y-4">
            {pages.map((p, i) => (
              <PageCard
                key={p.id}
                index={i}
                previewUrl={p.previewUrl}
                quality={p.quality}
                onView={() => setViewIndex(i)}
                onRotate={() => updatePage(i, rotate90)}
                onCrop={() => setCropIndex(i)}
                onRetake={() => openCamera(i)}
                onRemove={() => removePage(i)}
              />
            ))}
          </ol>
        </section>
      )}

      {busy && (
        <p className="flex items-center gap-2 text-brand" role="status">
          <SpinnerIcon className="size-5" />
          {t.scan.preparing}
        </p>
      )}

      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
          <AlertIcon className="mt-1 size-5 shrink-0" />
          {error}
        </p>
      )}

      {/* Add photos */}
      {!full ? (
        <div className={pages.length ? "grid grid-cols-2 gap-3" : "grid gap-3 sm:grid-cols-2"}>
          <button
            type="button"
            onClick={() => openCamera(null)}
            disabled={busy}
            className={`flex items-center justify-center gap-3 rounded-2xl bg-brand font-semibold text-white hover:bg-brand-deep disabled:opacity-60 ${pages.length ? "min-h-14 text-base" : "min-h-20 text-xl"}`}
          >
            {pages.length ? <PlusIcon className="size-5" /> : <CameraIcon className="size-7" />}
            {pages.length ? t.scan.addPage : t.scan.takePhoto}
          </button>
          <button
            type="button"
            onClick={() => {
              setReplaceAt(null);
              uploadRef.current?.click();
            }}
            disabled={busy}
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-brand bg-card font-semibold text-brand hover:bg-surface disabled:opacity-60 ${pages.length ? "min-h-14" : "min-h-20 text-lg"}`}
          >
            <span className="flex items-center gap-2">
              <UploadIcon className="size-5" />
              {t.scan.uploadPhoto}
            </span>
            {!pages.length && <span className="text-xs font-normal text-muted">{t.scan.uploadHint}</span>}
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted">{fmt(t.scan.maxPagesReached, { max: CAPTURE.maxPages })}</p>
      )}

      {/* Continue */}
      {pages.length > 0 && (
        <div className="space-y-3 border-t border-line pt-6">
          {notRx && (
            <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-950" role="alert">
              <p className="font-semibold">{t.scan.notRx.title}</p>
              <p className="text-sm">{t.scan.notRx.text}</p>
            </div>
          )}
          {apiError && (
            <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
              <AlertIcon className="mt-1 size-5 shrink-0" />
              {t.scan.apiErrors[apiError]}
            </p>
          )}
          {anyProblem && <p className="text-sm text-amber-800">{t.scan.quality.canContinue}</p>}
          {!consentAsked && (
            <ConsentBox
              checked={consent}
              showError={consentError && !consent}
              onChange={(v) => {
                setConsent(v);
                if (v) setConsentError(false);
              }}
            />
          )}
          <button
            type="button"
            onClick={onContinue}
            disabled={busy}
            className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 text-xl font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {apiError ? t.scan.tryAgain : t.scan.continue}
          </button>
        </div>
      )}

      {/* Overlays */}
      {cameraOpen && (
        <CameraCapture
          cameraAppInputId={CAMERA_APP_INPUT}
          onClose={() => {
            setCameraOpen(false);
            setReplaceAt(null);
          }}
          onCapture={(blob) => {
            setCameraOpen(false);
            addFiles([new File([blob], "camera.jpg", { type: "image/jpeg" })], replaceAt);
          }}
        />
      )}

      {cropIndex !== null && pages[cropIndex] && (
        <CropEditor
          canvas={pages[cropIndex].canvas}
          onCancel={() => setCropIndex(null)}
          onApply={(r: CropRect) => {
            const i = cropIndex;
            setCropIndex(null);
            updatePage(i, (c) => crop(c, r), true);
          }}
        />
      )}

      {viewIndex !== null && pages[viewIndex] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={fmt(t.scan.pageLabel, { n: viewIndex + 1 })}
          className="fixed inset-0 z-50 flex flex-col bg-black/95"
          onClick={() => setViewIndex(null)}
        >
          <div className="flex justify-end p-3">
            <button type="button" aria-label={t.scan.close} className="grid size-12 place-items-center rounded-full bg-white/15 text-white">
              <CloseIcon className="size-6" />
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pages[viewIndex].previewUrl} alt="" className="min-h-0 flex-1 object-contain p-2" />
        </div>
      )}
    </div>
  );
}
