import { describe, expect, it } from "vitest";
import sample from "@/tests/fixtures/extraction-handwritten.json";
import { Prescription, type CheckWarning } from "@/lib/schemas/extraction";
import { crossCheck, computeTotal } from "@/lib/rx/checks";
import {
  attentionCount, attentionPaths, finalPrescription, getTop, initReview, medPath, newReviewMed, setTop, updateMed,
} from "@/lib/rx/review";

const start = () => {
  const { prescription, checks } = crossCheck(Prescription.parse(sample));
  return initReview(prescription, checks);
};

describe("initReview flags", () => {
  it("flags what the AI was unsure about or couldn't read", () => {
    const s = start();
    const [, , , rigix, unknown] = s.meds;
    expect(s.flags["patient.weight"]?.reasons).toContain("unreadable"); // "patient weight"
    expect(s.flags[medPath(rigix.id, "strength")]?.reasons).toContain("uncertain");
    expect(s.flags[medPath(unknown.id, "brand_name")]?.reasons).toEqual(expect.arrayContaining(["uncertain", "unreadable"]));
    expect(s.flags[medPath(unknown.id, "strength")]).toBeDefined(); // "medicine 5 strength"
    expect(s.unreadable.every((u) => u.matched)).toBe(true);
  });

  it("does not flag fields that are simply not written", () => {
    const s = start();
    expect(s.flags["patient.address"]).toBeUndefined();
    expect(s.flags["patient.phone"]).toBeUndefined();
  });

  it("flags disagreements from our own check with a suggestion", () => {
    const rx = Prescription.parse(sample);
    const checks: CheckWarning[] = [{ medicineIndex: 0, field: "total_quantity_needed", aiValue: "12 tablets", expected: "10 tablets", message: "" }];
    const s = initReview(rx, checks);
    expect(s.flags[medPath(s.meds[0].id, "total_quantity_needed")]).toEqual({ reasons: ["check"], suggestion: "10 tablets" });
  });

  it("keeps unmatched unreadable notes for manual checking", () => {
    const rx = Prescription.parse({ ...sample, unreadable_fields: ["stamp at bottom"] });
    const s = initReview(rx, []);
    expect(s.unreadable).toEqual([{ text: "stamp at bottom", matched: false, done: false }]);
  });
});

describe("attention", () => {
  it("counts flagged fields and drops them once confirmed", () => {
    const s = start();
    const before = attentionCount(s, false);
    expect(before).toBe(4);
    const first = attentionPaths(s, false)[0];
    expect(attentionCount({ ...s, confirmed: [first] }, false)).toBe(before - 1);
  });

  it("hides pharmacist-only fields from the patient count", () => {
    const rx = Prescription.parse({ ...sample, doctor: { ...sample.doctor, registration_no: { value: "PMDC 1?", confidence: "low" } } });
    const s = initReview(rx, []);
    expect(attentionPaths(s, true)).toContain("doctor.registration_no");
    expect(attentionPaths(s, false)).not.toContain("doctor.registration_no");
  });

  it("ignores flags of removed medicines", () => {
    const s = start();
    const withoutLast = { ...s, meds: s.meds.slice(0, 4) };
    expect(attentionCount(withoutLast, false)).toBe(2); // weight + Rigix strength
  });
});

describe("editing", () => {
  it("setTop stores the value as checked (high confidence) and empties blanks", () => {
    const rx = Prescription.parse(sample);
    expect(getTop(setTop(rx, "patient.weight", "70 kg"), "patient.weight")).toEqual({ value: "70 kg", confidence: "high" });
    expect(getTop(setTop(rx, "patient.name", "  "), "patient.name").value).toBeNull();
    expect(getTop(rx, "patient.weight").value).toBeNull(); // original not changed
  });

  it("changing the written frequency updates times and schedule", () => {
    const med = start().meds[0].data;
    const m = updateMed(med, "frequency_text", "TDS");
    expect(m.times_per_day).toBe(3);
    expect(m.schedule).toEqual({ morning: 1, afternoon: 1, evening: 0, night: 1 });
    const sos = updateMed(med, "frequency_text", "SOS");
    expect(sos.times_per_day).toBeNull();
  });

  it("changing the written duration updates the number of days", () => {
    expect(updateMed(start().meds[0].data, "duration_text", "2/52").duration_days).toBe(14);
  });

  it("calculate gives the total from dose, times and days", () => {
    const m = updateMed(start().meds[0].data, "frequency_text", "TDS");
    expect(computeTotal(m)).toBe("15 tablets");
  });

  it("final prescription drops empty new medicines", () => {
    const s = start();
    const final = finalPrescription({ ...s, meds: [...s.meds, newReviewMed()] });
    expect(final.medicines).toHaveLength(5);
  });
});
