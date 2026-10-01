/**
 * The four unit tests named in the project brief (section 11), in one place.
 * More detailed versions live in shorthand.test.ts, checks.test.ts and safety.test.ts.
 */
import { describe, expect, it } from "vitest";
import sample from "@/tests/fixtures/extraction-handwritten.json";
import { Prescription, type Medicine } from "@/lib/schemas/extraction";
import { parseDuration, parseFrequency } from "@/lib/rx/shorthand";
import { computeTotal } from "@/lib/rx/checks";
import { findDuplicates } from "@/lib/rx/safety";

const base = Prescription.parse(sample);
const med = (m: Partial<Medicine>): Medicine => ({ ...base.medicines[0], ...m });

describe("frequency parsing", () => {
  it.each([
    ["1+0+1", 2], ["1-0-1", 2], ["1+1+1", 3], ["0+0+1", 1], ["OD", 1], ["BD", 2], ["BID", 2], ["TDS", 3], ["TID", 3], ["QID", 4], ["HS", 1],
  ])("%s → %i times a day", (text, n) => {
    expect(parseFrequency(text)?.timesPerDay).toBe(n);
  });
});

describe("duration parsing", () => {
  it.each([
    ["x 1/52", 7], ["x 2/52", 14], ["x 1/12", 30], ["x 5 days", 5], ["5/7", 5], ["x 10 days", 10],
  ])("%s → %i days", (text, days) => {
    expect(parseDuration(text)?.days).toBe(days);
  });
});

describe("total quantity calculation", () => {
  it("1 tablet 1+0+1 for 5 days = 10 tablets", () => {
    expect(computeTotal(med({ dose_per_time: "1 tablet", frequency_text: "1+0+1", times_per_day: 2, duration_days: 5, dosage_form: "tablet" }))).toBe("10 tablets");
  });
  it("5 ml syrup TDS for 7 days = 105 ml", () => {
    expect(computeTotal(med({ dose_per_time: "5 ml", frequency_text: "TDS", times_per_day: 3, duration_days: 7, dosage_form: "suspension", schedule: { morning: 1, afternoon: 1, evening: 0, night: 1 } }))).toMatch(/^105 ml/);
  });
  it("no number of days → no guess", () => {
    expect(computeTotal(med({ duration_days: null }))).toBeNull();
  });
});

describe("duplicate-generic detection", () => {
  it("same generic under two brands (Panadol + Calpol = paracetamol twice)", () => {
    const rx = { ...base, medicines: [med({ brand_name: "Panadol", generic_name: "Paracetamol" }), med({ brand_name: "Calpol", generic_name: "Paracetamol" })] };
    const alerts = findDuplicates(rx);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("duplicate-therapy");
    expect(alerts[0].drugs).toEqual(["Panadol", "Calpol"]);
  });
  it("different medicines are not duplicates", () => {
    const rx = { ...base, medicines: [med({ brand_name: "Panadol", generic_name: "Paracetamol" }), med({ brand_name: "Risek", generic_name: "Omeprazole" })] };
    expect(findDuplicates(rx)).toEqual([]);
  });
});
