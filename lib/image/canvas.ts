// Basic picture operations done on the phone, using <canvas>.

export type Source = HTMLCanvasElement | ImageBitmap | HTMLImageElement;

function sizeOf(src: Source) {
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth, h: src.naturalHeight };
  return { w: src.width, h: src.height };
}

export function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Copy a picture, shrinking it so its longest side is at most `maxSide`. */
export function scaleTo(src: Source, maxSide: number): HTMLCanvasElement {
  const { w, h } = sizeOf(src);
  const k = Math.min(1, maxSide / Math.max(w, h));
  const c = makeCanvas(w * k, h * k);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; // transparent PNG/PDF areas become white, not black
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/** Turn the picture 90° clockwise. */
export function rotate90(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = makeCanvas(src.height, src.width);
  const ctx = c.getContext("2d")!;
  ctx.translate(c.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(src, 0, 0);
  return c;
}

/** Crop using fractions of the picture (0 to 1), e.g. { x: 0.1, y: 0, w: 0.8, h: 1 }. */
export type CropRect = { x: number; y: number; w: number; h: number };
export function crop(src: HTMLCanvasElement, r: CropRect): HTMLCanvasElement {
  const sx = Math.round(r.x * src.width);
  const sy = Math.round(r.y * src.height);
  const sw = Math.round(r.w * src.width);
  const sh = Math.round(r.h * src.height);
  const c = makeCanvas(sw, sh);
  c.getContext("2d")!.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
  return c;
}

export function toJpegBlob(c: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", quality),
  );
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
