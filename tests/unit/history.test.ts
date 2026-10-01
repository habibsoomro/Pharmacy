import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import elderlyJson from "@/tests/fixtures/extraction-elderly.json";
import sample from "@/tests/fixtures/extraction-handwritten.json";
import { Prescription } from "@/lib/schemas/extraction";
import type { CurrentScan } from "@/lib/client/scan-session";
import { localReport } from "@/lib/client/safety";
import {
  deleteAllHistory, deleteFromHistory, isQuotaError, listHistory, loadFromHistory, matchesSearch, saveToHistory, summarize, updateInHistory,
} from "@/lib/client/history";

const elderly = Prescription.parse(elderlyJson);
const handwritten = Prescription.parse(sample);
const photo = { mediaType: "image/jpeg", base64: "A".repeat(500) };
const scanOf = (rx: Prescription, extra: Partial<CurrentScan> = {}): CurrentScan => ({ createdAt: "2026-10-01T08:00:00Z", result: rx, checks: [], images: [photo], ...extra });

beforeEach(async () => {
  await deleteAllHistory();
});

describe("my prescriptions (on this phone)", () => {
  it("summarises a scan for the list", () => {
    const info = summarize({ result: elderly, safety: { key: "k", report: localReport(elderly) } });
    expect(info.patient).toBe(elderly.patient.name.value);
    expect(info.medicines).toContain("Coumadin");
    expect(info.seriousAlerts).toBeGreaterThan(0);
  });

  it("saves, lists newest first, and opens with photos", async () => {
    const a = await saveToHistory(scanOf(handwritten), { now: new Date("2026-09-01T10:00:00Z"), thumb: "data:image/jpeg;base64,xx" });
    const b = await saveToHistory(scanOf(elderly), { now: new Date("2026-10-01T10:00:00Z") });
    const list = await listHistory();
    expect(list.map((x) => x.id)).toEqual([b.id, a.id]);
    expect(list[1]).toMatchObject({ thumb: "data:image/jpeg;base64,xx", photoCount: 1 });
    expect("images" in list[0].scan).toBe(false); // the list never loads full photos

    const opened = await loadFromHistory(a.id);
    expect(opened?.historyId).toBe(a.id);
    expect(opened?.images).toEqual([photo]);
    expect(opened?.result).toEqual(handwritten);
  });

  it("keeps a saved prescription up to date, but never brings back a deleted one", async () => {
    const { id } = await saveToHistory(scanOf(handwritten));
    const opened = (await loadFromHistory(id))!;
    expect(await updateInHistory({ ...opened, startDate: "2026-10-03" })).toBe(true);
    expect((await loadFromHistory(id))?.startDate).toBe("2026-10-03");

    await deleteFromHistory(id);
    expect(await updateInHistory({ ...opened, startDate: "2026-10-04" })).toBe(false);
    expect(await listHistory()).toEqual([]);
    expect(await loadFromHistory(id)).toBeNull();
  });

  it("does nothing for scans that were never saved", async () => {
    expect(await updateInHistory(scanOf(handwritten))).toBe(false);
    expect(await listHistory()).toHaveLength(0);
  });

  it("deletes one or all", async () => {
    const a = await saveToHistory(scanOf(handwritten));
    await saveToHistory(scanOf(elderly));
    await deleteFromHistory(a.id);
    expect((await listHistory()).map((x) => x.info.patient)).toEqual([elderly.patient.name.value]);
    await deleteAllHistory();
    expect(await listHistory()).toHaveLength(0);
  });

  it("searches by patient, doctor or medicine", () => {
    const item = { info: summarize({ result: elderly }) };
    expect(matchesSearch(item, "coumadin")).toBe(true);
    expect(matchesSearch(item, elderly.patient.name.value!.slice(0, 4).toLowerCase())).toBe(true);
    expect(matchesSearch(item, "zzz")).toBe(false);
    expect(matchesSearch(item, "  ")).toBe(true);
  });

  it("recognises 'phone storage full' errors", () => {
    expect(isQuotaError({ name: "QuotaExceededError" })).toBe(true);
    expect(isQuotaError(new Error("x"))).toBe(false);
  });
});
