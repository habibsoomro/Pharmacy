import { describe, expect, it } from "vitest";
import { crossCheck, lookupGeneric, sameGeneric } from "@/lib/rx/checks";
import { Prescription, type Medicine } from "@/lib/schemas/extraction";
import sample from "@/tests/fixtures/extraction-handwritten.json";

const baseMed: Medicine = {
  brand_name: "Augmentin", generic_name: "Amoxicillin + Clavulanic acid", brand_mapping_certain: true,
  strength: "625 mg", dosage_form: "tablet", dose_per_time: "1 tablet", frequency_text: "1+0+1",
  times_per_day: 2, schedule: { morning: 1, afternoon: 0, evening: 0, night: 1 }, route: "oral",
  food_timing: "after meal", duration_days: 5, duration_text: "x 5 days", total_quantity_needed: "10 tablets",
  special_instructions: null, purpose_in_simple_words: "antibiotic", confidence: "high", uncertain_fields: [],
};
const rxWith = (meds: Partial<Medicine>[]) =>
  Prescription.parse({ ...sample, medicines: meds.map((m) => ({ ...baseMed, ...m })) });

describe("lookupGeneric", () => {
  it("finds brands with form and strength around them", () => {
    expect(lookupGeneric("Tab. Panadol 500mg")).toBe("Paracetamol");
    expect(lookupGeneric("Panadol Extra")).toBe("Paracetamol + Caffeine");
    expect(lookupGeneric("Syp Brufen")).toBe("Ibuprofen");
    expect(lookupGeneric("Augmentin DS")).toBe("Amoxicillin + Clavulanic acid");
    expect(lookupGeneric("Unknownium")).toBeNull();
  });
});

describe("sameGeneric", () => {
  it("matches equivalent names", () => {
    expect(sameGeneric("Co-amoxiclav", "Amoxicillin + Clavulanic acid")).toBe(true);
    expect(sameGeneric("Amoxicillin/clavulanate potassium", "Amoxicillin + Clavulanic acid")).toBe(true);
    expect(sameGeneric("Sulfamethoxazole + Trimethoprim", "Co-trimoxazole (Sulfamethoxazole + Trimethoprim)")).toBe(true);
    expect(sameGeneric("Candesartan", "Candesartan")).toBe(true);
  });
  it("catches different medicines", () => {
    expect(sameGeneric("Amoxicillin", "Amoxicillin + Clavulanic acid")).toBe(false);
    expect(sameGeneric("Esomeprazole", "Omeprazole")).toBe(false);
  });
});

describe("crossCheck", () => {
  it("accepts a correct medicine with no warnings", () => {
    const { checks } = crossCheck(rxWith([{}]));
    expect(checks).toEqual([]);
  });

  it("fills in missing numbers from the shorthand", () => {
    const { prescription, checks } = crossCheck(
      rxWith([{ times_per_day: null, duration_days: null, total_quantity_needed: null, schedule: { morning: 0, afternoon: 0, evening: 0, night: 0 } }]),
    );
    const m = prescription.medicines[0];
    expect(m.times_per_day).toBe(2);
    expect(m.duration_days).toBe(5);
    expect(m.total_quantity_needed).toBe("10 tablets");
    expect(m.schedule).toEqual({ morning: 1, afternoon: 0, evening: 0, night: 1 });
    expect(checks).toEqual([]);
  });

  it("flags disagreement and lowers confidence", () => {
    const { prescription, checks } = crossCheck(rxWith([{ times_per_day: 3, total_quantity_needed: "15 tablets" }]));
    expect(checks.map((c) => c.field)).toEqual(["times_per_day"]);
    expect(prescription.medicines[0].confidence).toBe("low");
  });

  it("flags a wrong total quantity", () => {
    const { checks } = crossCheck(rxWith([{ total_quantity_needed: "12 tablets" }]));
    expect(checks[0].field).toBe("total_quantity_needed");
    expect(checks[0].expected).toBe("10 tablets");
  });

  it("flags a brand mapped to the wrong generic", () => {
    const { checks } = crossCheck(rxWith([{ brand_name: "Risek", generic_name: "Esomeprazole" }]));
    expect(checks.some((c) => c.field === "generic_name" && c.expected === "Omeprazole")).toBe(true);
  });

  it("syrup quantity in ml", () => {
    const { prescription } = crossCheck(
      rxWith([{ brand_name: "Calpol", generic_name: "Paracetamol", dosage_form: "syrup", dose_per_time: "1 tsp", frequency_text: "TDS", times_per_day: 3, duration_days: 3, duration_text: "3 days", total_quantity_needed: null }]),
    );
    expect(prescription.medicines[0].total_quantity_needed).toBe("45 ml");
  });

  it("does not invent a quantity for SOS medicines", () => {
    const { prescription } = crossCheck(rxWith([{ frequency_text: "SOS", times_per_day: null, total_quantity_needed: null, duration_text: null, duration_days: null }]));
    expect(prescription.medicines[0].total_quantity_needed).toBeNull();
  });
});

describe("Prescription schema", () => {
  it("tidies common AI slips instead of failing", () => {
    const parsed = Prescription.parse({
      ...sample,
      overall_legibility: "Fair",
      medicines: [{ ...baseMed, times_per_day: "2", duration_days: "", confidence: "HIGH", food_timing: "After meal", strength: "N/A" }],
    });
    const m = parsed.medicines[0];
    expect(m.times_per_day).toBe(2);
    expect(m.duration_days).toBeNull();
    expect(m.confidence).toBe("high");
    expect(m.food_timing).toBe("after meal");
    expect(m.strength).toBeNull();
    expect(parsed.overall_legibility).toBe("fair");
  });
});
