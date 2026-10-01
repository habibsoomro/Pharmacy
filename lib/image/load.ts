import { CAPTURE } from "@/config/capture";
import { scaleTo } from "@/lib/image/canvas";

export type LoadError = "unsupported" | "tooLarge" | "readFailed" | "heicFailed" | "pdfFailed";
export class ImageLoadError extends Error {
  constructor(public code: LoadError) {
    super(code);
  }
}

export type Loaded = {
  canvas: HTMLCanvasElement; // working copy, longest side ≤ workingMaxSide
  originalWidth: number;
  originalHeight: number;
};

const isHeic = (f: File) => /image\/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name);
const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const isImage = (f: File) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name);

/** Open any supported file (photo, iPhone HEIC, or first page of a PDF) as a picture. */
export async function loadFile(file: File | Blob, name = (file as File).name ?? "photo.jpg"): Promise<Loaded> {
  const f = file instanceof File ? file : new File([file], name, { type: file.type });
  if (f.size > CAPTURE.maxInputFileMB * 1024 * 1024) throw new ImageLoadError("tooLarge");

  if (isPdf(f)) return loadPdfFirstPage(f);

  let blob: Blob = f;
  if (isHeic(f)) {
    blob = await convertHeic(f);
  } else if (!isImage(f)) {
    throw new ImageLoadError("unsupported");
  }
  return loadBitmap(blob);
}

async function loadBitmap(blob: Blob): Promise<Loaded> {
  let bmp: ImageBitmap | HTMLImageElement;
  try {
    // "from-image" respects the phone's rotation info so photos aren't sideways.
    bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    try {
      bmp = await loadViaImg(blob);
    } catch {
      throw new ImageLoadError("readFailed");
    }
  }
  const w = bmp instanceof HTMLImageElement ? bmp.naturalWidth : bmp.width;
  const h = bmp instanceof HTMLImageElement ? bmp.naturalHeight : bmp.height;
  const canvas = scaleTo(bmp, CAPTURE.workingMaxSide);
  if ("close" in bmp) bmp.close();
  return { canvas, originalWidth: w, originalHeight: h };
}

function loadViaImg(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("img load failed")); };
    img.src = url;
  });
}

async function convertHeic(f: File): Promise<Blob> {
  // Some browsers (Safari) can open HEIC directly. Try that first; it's faster.
  try {
    const b = await createImageBitmap(f);
    b.close();
    return f;
  } catch {
    /* fall through to converter */
  }
  try {
    // Only downloaded when someone actually uploads a HEIC photo.
    const heic2any = (await import("heic2any")).default;
    const out = await heic2any({ blob: f, toType: "image/jpeg", quality: 0.92 });
    return Array.isArray(out) ? out[0] : out;
  } catch {
    throw new ImageLoadError("heicFailed");
  }
}

async function loadPdfFirstPage(f: File): Promise<Loaded> {
  try {
    // Only downloaded when someone uploads a PDF.
    // "legacy" build = works on older Android browsers too.
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.min.mjs");
    // The worker file is copied into /public by scripts/copy-pdf-worker.mjs on install.
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const task = pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()) });
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = CAPTURE.workingMaxSide / Math.max(base.width, base.height);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    await task.destroy();
    // A PDF has no "photo size", so treat it as full quality.
    return { canvas, originalWidth: canvas.width, originalHeight: canvas.height };
  } catch (err) {
    console.error("PDF open failed:", err);
    throw new ImageLoadError("pdfFailed");
  }
}
