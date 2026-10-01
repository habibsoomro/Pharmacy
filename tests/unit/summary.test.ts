import { describe, expect, it } from "vitest";
import elderlyJson from "@/tests/fixtures/extraction-elderly.json";
import sample from "@/tests/fixtures/extraction-handwritten.json";
import { Prescription, type Medicine } from "@/lib/schemas/extraction";
import { addDays, courseFor, daysBetween, defaultStartDate, parseRxDate } from "@/lib/summary/dates";
import { buildTimetable } from "@/lib/summary/timetable";
import { howToTake } from "@/lib/summary/how-to-take";
import { buildCare } from "@/lib/summary/care";
import { localReport } from "@/lib/client/safety";

const rx = Prescription.parse(sample);
const elderly = Prescription.parse(elderlyJson);
const med = (m: Partial<Medicine>): Medicine => ({ ...rx.medicines[0], ...m });

describe("dates", () => {
  it("reads Pakistani date styles", () => {
    expect(parseRxDate("28/09/2026")).toBe("2026-09-28");
    expect(parseRxDate("28-9-26")).toBe("2026-09-28");
    expect(parseRxDate("2026-09-28")).toBe("2026-09-28");
    expect(parseRxDate("31/02/2026")).toBeNull();
    expect(parseRxDate("After 5 days")).toBeNull();
  });
  it("adds and counts days across months", () => {
    expect(addDays("2026-09-28", 4)).toBe("2026-10-02");
    expect(daysBetween("2026-09-28", "2026-10-01")).toBe(3);
  });
  it("starts from the prescription date only if it makes sense", () => {
    expect(defaultStartDate("2026-09-28", "2026-10-01")).toBe("2026-09-28");
    expect(defaultStartDate("2026-12-01", "2026-10-01")).toBe("2026-10-01"); // future
    expect(defaultStartDate("2025-01-01", "2026-10-01")).toBe("2026-10-01"); // too old
    expect(defaultStartDate(null, "2026-10-01")).toBe("2026-10-01");
  });
});

describe("course calendar", () => {
  it("5-day course started 3 days ago is on day 4", () => {
    const c = courseFor(med({ duration_days: 5 }), "2026-09-28", "2026-10-01");
    expect(c).toMatchObject({ kind: "fixed", end: "2026-10-02", dayNumber: 4, status: "active", totalDays: 5 });
  });
  it("marks the last day and finished courses", () => {
    expect(courseFor(med({ duration_days: 5 }), "2026-09-28", "2026-10-02")).toMatchObject({ status: "lastDay", progress: 1 });
    expect(courseFor(med({ duration_days: 5 }), "2026-09-20", "2026-10-02")).toMatchObject({ status: "done" });
    expect(courseFor(med({ duration_days: 5 }), "2026-10-05", "2026-10-02")).toMatchObject({ status: "upcoming", progress: 0 });
  });
  it("handles ongoing, as-needed and missing durations", () => {
    expect(courseFor(med({ duration_days: null, duration_text: "continue" }), "2026-10-01").kind).toBe("ongoing");
    expect(courseFor(med({ duration_days: null, duration_text: null, frequency_text: "SOS" }), "2026-10-01").kind).toBe("asNeeded");
    expect(courseFor(med({ duration_days: null, duration_text: null }), "2026-10-01").kind).toBe("unknown");
  });
});

describe("timetable", () => {
  it("puts each medicine in the right times of day", () => {
    const t = buildTimetable(rx.medicines);
    expect(t.slots.morning.map((i) => i.name)).toEqual(["Augmentin", "Risek", "Klorofin?"]);
    expect(t.slots.afternoon.map((i) => i.name)).toEqual(["Klorofin?"]);
    expect(t.slots.night.map((i) => i.name)).toEqual(["Augmentin", "Rigix", "Klorofin?"]);
    expect(t.asNeeded.map((i) => i.name)).toEqual(["Panadol"]);
  });
  it("shows different amounts for uneven patterns like 1+0+2", () => {
    const t = buildTimetable([med({ dose_per_time: null, frequency_text: "1+0+2", schedule: { morning: 1, afternoon: 0, evening: 0, night: 2 } })]);
    expect(t.slots.morning[0].amount).toBe("1 tablet");
    expect(t.slots.night[0].amount).toBe("2 tablets");
  });
});

describe("how to take", () => {
  it.each([
    [{ dosage_form: "tablet", route: "oral" }, "swallow", false],
    [{ dosage_form: "suspension", route: "oral" }, "liquid", true],
    [{ dosage_form: "effervescent tablet", route: "oral" }, "dissolve", false],
    [{ dosage_form: "eye drops", route: "eye" }, "eye", false],
    [{ dosage_form: "cream", route: "topical" }, "skin", false],
    [{ dosage_form: "inhaler", route: "inhaled" }, "inhale", false],
    [{ dosage_form: "gargle", route: "mouth gargle" }, "gargle", false],
  ])("%o → %s", (m, how, shake) => {
    expect(howToTake({ special_instructions: null, ...m })).toEqual({ how, shake });
  });
});

describe("general care", () => {
  it("lists side effects per medicine and food warnings from the safety check", () => {
    const care = buildCare(elderly.medicines, localReport(elderly));
    expect(care.sideEffects.find((s) => s.name === "Coumadin")?.items).toContain("Bruising more easily");
    expect(care.urgent.some((u) => /black stools/i.test(u))).toBe(true);
    expect(care.avoid.some((a) => /milk/i.test(a))).toBe(true);
    expect(care.storage.some((s) => /effervescent/i.test(s))).toBe(true); // Cac-1000
    expect(care.storage.some((s) => /30°C/.test(s))).toBe(true);
  });
});
