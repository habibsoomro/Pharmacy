/**
 * The 5 sample prescriptions from the brief, run through the whole reading
 * pipeline: AI answer check → our shorthand double-check → safety check → summary.
 */
import { describe, expect, it } from "vitest";
import printed from "@/tests/fixtures/extraction-printed.json";
import handwritten from "@/tests/fixtures/extraction-handwritten.json";
import child from "@/tests/fixtures/extraction-child.json";
import elderly from "@/tests/fixtures/extraction-elderly.json";
import notRx from "@/tests/fixtures/extraction-not-prescription.json";
import aiPrinted from "@/tests/fixtures/interactions-printed.json";
import aiChild from "@/tests/fixtures/interactions-child.json";
import aiElderly from "@/tests/fixtures/interactions-elderly.json";
import { ExtractionResult, type Prescription } from "@/lib/schemas/extraction";
import { AiInteractions } from "@/lib/schemas/safety";
import { crossCheck } from "@/lib/rx/checks";
import { localSafetyCheck, mergeReports } from "@/lib/rx/safety";
import { buildTimetable } from "@/lib/summary/timetable";
import { planReminders } from "@/lib/summary/reminders";
import { DEFAULT_SETTINGS } from "@/lib/settings";

function read(json: unknown): { rx: Prescription; checks: ReturnType<typeof crossCheck>["checks"] } {
  const result = ExtractionResult.parse(json);
  if (!result.is_prescription) throw new Error("not a prescription");
  const { prescription, checks } = crossCheck(result);
  return { rx: prescription, checks };
}
const report = (rx: Prescription, ai: unknown) => mergeReports(rx, localSafetyCheck(rx), AiInteractions.parse(ai));
const severities = (r: ReturnType<typeof report>) => r.alerts.map((a) => a.severity);

describe("1. clean printed prescription", () => {
  const { rx, checks } = read(printed);
  it("reads cleanly with nothing to flag", () => {
    expect(rx.overall_legibility).toBe("good");
    expect(rx.unreadable_fields).toEqual([]);
    expect(checks).toEqual([]); // our shorthand check agrees with every number
  });
  it("understands 1/12 and 2/52", () => {
    expect(rx.medicines.map((m) => [m.brand_name, m.duration_days, m.total_quantity_needed])).toEqual([
      ["Glucophage", 30, "60 tablets"], ["Concor", 30, "30 tablets"], ["Risek", 14, "14 capsules"], ["Softin", 5, "5 tablets"],
    ]);
  });
  it("has no serious safety alerts", () => {
    const r = report(rx, aiPrinted);
    expect(severities(r)).not.toContain("major");
    expect(r.alerts.some((a) => a.drugs.includes("Concor"))).toBe(true); // the AI's minor note is kept
  });
});

describe("2. messy handwriting", () => {
  const { rx, checks } = read(handwritten);
  it("keeps what couldn't be read visible instead of guessing", () => {
    expect(rx.overall_legibility).toBe("fair");
    expect(rx.unreadable_fields.length).toBeGreaterThan(0);
    expect(rx.medicines.some((m) => m.confidence === "low")).toBe(true);
  });
  it("fills in missing numbers from the shorthand", () => {
    const risek = rx.medicines.find((m) => m.brand_name === "Risek")!;
    expect(risek.duration_days).toBe(7); // "1/52"
    expect(risek.total_quantity_needed).toBe("7 capsules");
    expect(checks.every((c) => c.message.length > 0)).toBe(true);
  });
  it("works without the AI safety check, and says so", () => {
    const r = mergeReports(rx, localSafetyCheck(rx), null);
    expect(r.aiChecked).toBe(false);
  });
});

describe("3. child prescription with syrups in ml", () => {
  const { rx } = read(child);
  it("calculates syrup quantities in ml", () => {
    expect(rx.medicines[0].total_quantity_needed).toMatch(/105 ml/);
    expect(rx.medicines[2].total_quantity_needed).toMatch(/45 ml/);
  });
  it("catches the paracetamol dose that is too high for a 14 kg child", () => {
    const r = report(rx, aiChild);
    const dose = r.alerts.find((a) => a.type === "dose-check" && a.drugs.includes("Calpol"));
    expect(dose?.severity).toBe("major");
    expect(dose?.sources.sort()).toEqual(["ai", "local"]); // found by both checks, shown once
    expect(r.ageWarnings.length).toBeGreaterThan(0);
  });
  it("puts the as-needed fever syrup outside the fixed timetable and reminders", () => {
    expect(buildTimetable(rx.medicines).asNeeded.map((x) => x.name)).toEqual(["Calpol"]);
    const plan = planReminders(rx.medicines, "2026-09-30", DEFAULT_SETTINGS.reminderTimes, "2026-09-30");
    expect(plan.skipped.find((s) => s.name === "Calpol")?.reason).toBe("asNeeded");
    expect(plan.reminders.filter((r) => r.name === "Amoxil")).toHaveLength(3); // TDS
  });
});

describe("4. elderly patient with 6+ medicines and a real interaction", () => {
  const { rx } = read(elderly);
  it("has at least 6 medicines", () => {
    expect(rx.medicines.length).toBeGreaterThanOrEqual(6);
  });
  it("finds the warfarin + NSAID interaction as serious, first in the list", () => {
    const r = report(rx, aiElderly);
    const warfarinNsaid = r.alerts.find((a) => a.type === "drug-drug" && a.drugs.includes("Coumadin") && a.drugs.includes("Brufen"));
    expect(warfarinNsaid?.severity).toBe("major");
    expect(r.alerts[0].severity).toBe("major");
    expect(r.alerts.some((a) => a.type === "age-check")).toBe(true);
  });
});

describe("5. not a prescription", () => {
  it("is recognised and stops before any safety check", () => {
    const result = ExtractionResult.parse(notRx);
    expect(result.is_prescription).toBe(false);
  });
});
