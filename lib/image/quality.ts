import { CAPTURE } from "@/config/capture";
import { scaleTo, type Source } from "@/lib/image/canvas";

export type QualityReport = {
  tooDark: boolean;
  blurry: boolean;
  tooSmall: boolean;
  brightness: number; // 0–255
  sharpness: number; // higher = sharper
};

/**
 * Pure maths on greyscale pixels, kept separate so it can be unit-tested.
 * Brightness = average grey level.
 * Sharpness = how strongly neighbouring pixels differ (variance of the
 * Laplacian). Blurry photos have soft edges, so the score is low.
 */
export function measure(gray: Uint8ClampedArray | number[], w: number, h: number) {
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i];
  const brightness = sum / gray.length;

  let n = 0, mean = 0, m2 = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      n++;
      const d = lap - mean;
      mean += d / n;
      m2 += d * (lap - mean);
    }
  }
  const sharpness = n > 1 ? m2 / (n - 1) : 0;
  return { brightness, sharpness };
}

/** Check a photo. `originalShortSide` is from the photo before we shrank it. */
export function checkQuality(src: Source, originalShortSide: number): QualityReport {
  // Measure on a fixed size so the score means the same for every phone.
  const small = scaleTo(src, 800);
  const ctx = small.getContext("2d", { willReadFrequently: true })!;
  const { data } = ctx.getImageData(0, 0, small.width, small.height);
  const gray = new Uint8ClampedArray(small.width * small.height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  }
  const { brightness, sharpness } = measure(gray, small.width, small.height);
  const q = CAPTURE.quality;
  const tooDark = brightness < q.minBrightness;
  return {
    brightness: Math.round(brightness),
    sharpness: Math.round(sharpness),
    tooDark,
    // Dark photos always score low on sharpness, so only say "blurry" if light is OK.
    blurry: !tooDark && sharpness < q.minSharpness,
    tooSmall: originalShortSide < q.minShortSide,
  };
}

export const hasProblem = (r: QualityReport) => r.tooDark || r.blurry || r.tooSmall;
