import type { CheckWarning, ExtractionResult } from "@/lib/schemas/extraction";
import type { SafetyReport } from "@/lib/schemas/safety";
import { updateInHistory } from "@/lib/client/history";

/**
 * The scan currently being worked on, kept in this browser tab only
 * (sessionStorage is cleared when the tab is closed). Saving to
 * "My prescriptions" is a separate step the person chooses; once saved,
 * later changes (edits, start date, safety check) are kept up to date there too.
 */
export type CurrentScan = {
  createdAt: string;
  result: ExtractionResult;
  checks: CheckWarning[];
  images: { mediaType: string; base64: string }[]; // for side-by-side comparison
  /** Filled in when the person finishes the "Check what we read" screen. */
  review?: {
    reviewedAt: string;
    pharmacistMode: boolean;
    original: ExtractionResult; // what the AI read, before any edits
    confirmedCount: number;
    stillFlagged: number;
    generalNote: string;
    medicineNotes: string[]; // same order as result.medicines
  };
  /** Result of the safety check, with a fingerprint of what was checked. */
  safety?: { key: string; report: SafetyReport };
  /** Course start date chosen on the summary (YYYY-MM-DD). */
  startDate?: string;
  /** Set when this scan is saved in "My prescriptions" on this phone. */
  historyId?: string;
};

const KEY = "nuskha:current-scan";

export function saveCurrentScan(scan: CurrentScan): boolean {
  if (scan.historyId) updateInHistory(scan).catch(() => {}); // best effort; the tab copy below is what the screens use
  try {
    sessionStorage.setItem(KEY, JSON.stringify(scan));
    return true;
  } catch {
    // Storage full: keep the result but drop the photos.
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ ...scan, images: [] }));
    } catch {
      /* ignore */
    }
    return false;
  }
}

export function loadCurrentScan(): CurrentScan | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CurrentScan) : null;
  } catch {
    return null;
  }
}

export function clearCurrentScan() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
