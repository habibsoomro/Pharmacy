"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { CloseIcon, LightIcon, RetakeIcon, SpinnerIcon } from "@/components/icons";

type Props = {
  onCapture: (photo: Blob) => void;
  onClose: () => void;
  /** id of the hidden <input capture> that opens the phone's own camera app */
  cameraAppInputId: string;
};

/** Full-screen live camera using the back camera. */
export function CameraCapture({ onCapture, onClose, cameraAppInputId }: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"starting" | "live" | "failed">("starting");
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        });
        if (cancelled) return stream.getTracks().forEach((tr) => tr.stop());
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const track = stream.getVideoTracks()[0];
        // Some Android phones let the website switch on the camera light.
        const caps = track.getCapabilities?.() as { torch?: boolean } | undefined;
        setTorchAvailable(Boolean(caps?.torch));
        setStatus("live");
      } catch {
        if (!cancelled) setStatus("failed");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  // Close with the phone's back gesture / Escape key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || capturing) return;
    setCapturing(true);
    const c = document.createElement("canvas");
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext("2d")!.drawImage(video, 0, 0);
    c.toBlob((blob) => {
      setCapturing(false);
      if (blob) onCapture(blob);
    }, "image/jpeg", 0.95);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={t.scan.camera.title} className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />

        {status === "live" && (
          <>
            {/* Page guide: helps people fit the whole prescription in. */}
            <div className="pointer-events-none absolute inset-x-[7%] inset-y-[9%] rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            <p className="absolute inset-x-0 top-4 text-center text-base font-medium drop-shadow">{t.scan.camera.frameHint}</p>
          </>
        )}

        {status === "starting" && (
          <div className="absolute inset-0 grid place-items-center">
            <p className="flex items-center gap-2"><SpinnerIcon className="size-5" />{t.scan.camera.starting}</p>
          </div>
        )}

        {status === "failed" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 text-center">
            <p className="max-w-sm text-lg">{t.scan.camera.denied}</p>
            <label htmlFor={cameraAppInputId} className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl bg-white px-5 font-semibold text-[var(--brand)]">
              <RetakeIcon className="size-5" />
              {t.scan.camera.useCameraApp}
            </label>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 px-6 pt-4" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
        <button type="button" onClick={onClose} aria-label={t.scan.close} className="grid size-12 place-items-center rounded-full bg-white/15">
          <CloseIcon className="size-6" />
        </button>

        <button
          type="button"
          onClick={capture}
          disabled={status !== "live" || capturing}
          aria-label={t.scan.camera.capture}
          className="grid size-20 place-items-center rounded-full border-4 border-white disabled:opacity-40"
        >
          <span className="size-15 rounded-full bg-white" />
        </button>

        {torchAvailable ? (
          <button
            type="button"
            onClick={toggleTorch}
            aria-pressed={torchOn}
            aria-label={torchOn ? t.scan.camera.flashOff : t.scan.camera.flashOn}
            className={`grid size-12 place-items-center rounded-full ${torchOn ? "bg-yellow-300 text-black" : "bg-white/15"}`}
          >
            <LightIcon className="size-6" />
          </button>
        ) : (
          <span className="size-12" />
        )}
      </div>

      {status === "live" && (
        <label htmlFor={cameraAppInputId} className="cursor-pointer pb-4 text-center text-sm text-white/80 underline underline-offset-4">
          {t.scan.camera.useCameraApp}
        </label>
      )}
    </div>
  );
}
