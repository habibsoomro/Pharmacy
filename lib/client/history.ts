import type { CurrentScan } from "@/lib/client/scan-session";
import { displayName } from "@/lib/rx/drugs";

/**
 * "My prescriptions": saved ONLY on this phone, in the browser's IndexedDB.
 * Nothing here is ever sent to our server.
 *
 * Two stores, so the list opens quickly even with many photos saved:
 *   prescriptions: the reading, checks, notes and a small preview picture
 *   photos:        the full prescription photos (only loaded when one is opened)
 */
const DB_NAME = "nuskha";
const DB_VERSION = 1;
const RX = "prescriptions";
const PHOTOS = "photos";

/** What the list shows, worked out once when saving. */
export type SavedInfo = {
  patient: string | null;
  doctor: string | null;
  prescriptionDate: string | null;
  medicines: string[];
  seriousAlerts: number;
  legibility: "good" | "fair" | "poor";
};

export type SavedPrescription = {
  id: string;
  savedAt: string;
  info: SavedInfo;
  /** Small JPEG preview (data: URL), or null if there was no photo. */
  thumb: string | null;
  photoCount: number;
  /** The scan without its photos. */
  scan: Omit<CurrentScan, "images">;
};

type Photos = { id: string; images: CurrentScan["images"] };

export class HistoryUnavailableError extends Error {}

export function summarize(scan: Pick<CurrentScan, "result" | "safety">): SavedInfo {
  const rx = scan.result.is_prescription ? scan.result : null;
  return {
    patient: rx?.patient.name.value ?? null,
    doctor: rx?.doctor.name.value ?? null,
    prescriptionDate: rx?.prescription_date.value ?? null,
    medicines: rx?.medicines.map(displayName) ?? [],
    seriousAlerts: scan.safety?.report.alerts.filter((a) => a.severity === "major").length ?? 0,
    legibility: rx?.overall_legibility ?? "poor",
  };
}

/** Does the person's search match this saved prescription? (patient, doctor or medicine name) */
export function matchesSearch(item: Pick<SavedPrescription, "info">, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const { patient, doctor, medicines } = item.info;
  return [patient, doctor, ...medicines].some((s) => s?.toLowerCase().includes(q));
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new HistoryUnavailableError("IndexedDB not available"));
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      return reject(new HistoryUnavailableError("IndexedDB blocked"));
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(RX)) db.createObjectStore(RX, { keyPath: "id" });
      if (!db.objectStoreNames.contains(PHOTOS)) db.createObjectStore(PHOTOS, { keyPath: "id" });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(new HistoryUnavailableError(req.error?.message ?? "open failed"));
    req.onblocked = () => reject(new HistoryUnavailableError("open blocked"));
  }).catch((e) => {
    dbPromise = null;
    throw e;
  });
  return dbPromise;
}

/** Run some work in one transaction; resolves when it is safely written. */
async function run<T>(stores: string[], mode: IDBTransactionMode, work: (tx: IDBTransaction) => T): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result: T;
    try {
      result = work(tx);
    } catch (e) {
      tx.abort();
      return reject(e);
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("aborted"));
  });
}

const req2promise = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const withoutImages = ({ images: _images, ...rest }: CurrentScan): Omit<CurrentScan, "images"> => rest;

export function isQuotaError(e: unknown): boolean {
  const name = (e as { name?: string } | null)?.name;
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED";
}

/**
 * Save a scan in My prescriptions. If the phone is out of space, it is saved
 * without the photos. Returns the new id.
 */
export async function saveToHistory(scan: CurrentScan, opts: { thumb?: string | null; now?: Date } = {}): Promise<{ id: string; withoutPhotos: boolean }> {
  const id = scan.historyId ?? newId();
  const record: SavedPrescription = {
    id,
    savedAt: (opts.now ?? new Date()).toISOString(),
    info: summarize(scan),
    thumb: opts.thumb ?? null,
    photoCount: scan.images.length,
    scan: { ...withoutImages(scan), historyId: id },
  };
  const write = (photos: boolean) =>
    run([RX, PHOTOS], "readwrite", (tx) => {
      tx.objectStore(RX).put(photos ? record : { ...record, thumb: null, photoCount: 0 });
      if (photos && scan.images.length) tx.objectStore(PHOTOS).put({ id, images: scan.images } satisfies Photos);
    });
  try {
    await write(true);
    return { id, withoutPhotos: false };
  } catch (e) {
    if (!isQuotaError(e) || !scan.images.length) throw e;
    await write(false);
    return { id, withoutPhotos: true };
  }
}

/** Keep a saved prescription up to date after edits (only if it is still saved; never re-creates a deleted one). */
export async function updateInHistory(scan: CurrentScan): Promise<boolean> {
  const id = scan.historyId;
  if (!id) return false;
  return run([RX], "readwrite", (tx) => {
    const store = tx.objectStore(RX);
    let updated = false;
    const get = store.get(id);
    get.onsuccess = () => {
      const old = get.result as SavedPrescription | undefined;
      if (!old) return;
      store.put({ ...old, info: summarize(scan), scan: { ...withoutImages(scan), historyId: id } } satisfies SavedPrescription);
      updated = true;
    };
    return () => updated;
  }).then((f) => f());
}

/** All saved prescriptions, newest first (without the full photos). */
export async function listHistory(): Promise<SavedPrescription[]> {
  const all = await run([RX], "readonly", (tx) => req2promise(tx.objectStore(RX).getAll() as IDBRequest<SavedPrescription[]>));
  return all.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** One saved prescription with its photos, ready to open as the current scan. */
export async function loadFromHistory(id: string): Promise<CurrentScan | null> {
  const [rec, photos] = await run([RX, PHOTOS], "readonly", (tx) => [
    req2promise(tx.objectStore(RX).get(id) as IDBRequest<SavedPrescription | undefined>),
    req2promise(tx.objectStore(PHOTOS).get(id) as IDBRequest<Photos | undefined>),
  ] as const);
  const r = await rec;
  if (!r) return null;
  return { ...r.scan, images: (await photos)?.images ?? [], historyId: id };
}

export async function deleteFromHistory(id: string): Promise<void> {
  await run([RX, PHOTOS], "readwrite", (tx) => {
    tx.objectStore(RX).delete(id);
    tx.objectStore(PHOTOS).delete(id);
  });
}

export async function deleteAllHistory(): Promise<void> {
  await run([RX, PHOTOS], "readwrite", (tx) => {
    tx.objectStore(RX).clear();
    tx.objectStore(PHOTOS).clear();
  });
}

/** Ask the browser to keep our saved data even when the phone is low on space (best effort). */
export async function askToKeepStorage(): Promise<void> {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) await navigator.storage.persist?.();
  } catch {
    /* not supported: fine */
  }
}

/** Roughly how much this website stores on the phone, in bytes (null if the phone won't say). */
export async function storageUsed(): Promise<number | null> {
  try {
    const est = await navigator.storage?.estimate?.();
    return est?.usage ?? null;
  } catch {
    return null;
  }
}

/** A small preview of the first photo for the list (about 160 px). */
export async function makeThumb(images: CurrentScan["images"]): Promise<string | null> {
  const first = images[0];
  if (!first || typeof document === "undefined") return null;
  try {
    const img = new Image();
    img.src = `data:${first.mediaType};base64,${first.base64}`;
    await img.decode();
    const k = Math.min(1, 160 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.7);
  } catch {
    return null;
  }
}
