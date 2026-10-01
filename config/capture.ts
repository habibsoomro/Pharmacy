/**
 * PHOTO SETTINGS: limits and the quality-check thresholds.
 * The thresholds are starting values. If the app warns too often (or not
 * often enough) on real prescriptions, adjust them here.
 */
export const CAPTURE = {
  maxPages: 4,
  maxInputFileMB: 25, // biggest file a user can pick

  // Photo kept on the phone while editing (enough detail for crop/rotate).
  workingMaxSide: 2000, // kept modest so 4 pages fit in memory on low-end phones

  // Photo actually sent for reading (saves mobile data).
  outputMaxSide: 1600,
  outputJpegQuality: 0.85,

  quality: {
    // Average brightness 0 (black) to 255 (white). Below this = "too dark".
    minBrightness: 80,
    // Edge sharpness score. Below this = "blurry". Lower = fewer warnings.
    minSharpness: 120,
    // Shorter side of the ORIGINAL photo in pixels. Below this = "too small".
    minShortSide: 900,
  },
} as const;
