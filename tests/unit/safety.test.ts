import { describe, expect, it } from "vitest";
import elderlyJson from "@/tests/fixtures/extraction-elderly.json";
import aiElderly from "@/tests/fixtures/interactions-elderly.json";
import sample from "@/tests/fixtures/extraction-handwritten.json";
import { Prescription, type Medicine } from "@/lib/schemas/extraction";
import { AiInteractions } from "@/lib/schemas/safety";
import { findDuplicates, localSafetyCheck, mergeReports, safeAdvice } from "@/lib/rx/safety";
import { ingredientsOf, isSystemic, matchesTerm, coreName } from "@/lib/rx/drugs";
import { mgPerDay, mgPerDose, parseAgeYears, parseStrength, parseWeightKg } from "@/lib/rx/dose";

const elderly = Prescription.parse(elderlyJson);
const base = Prescription.parse(sample);
const med = (m: Partial<Medicine>): Medicine => ({ ...base.medicines[0], uncertain_fields: [], confidence: "high", ...m });
const rxWith = (medicines: Medicine[], extra: Partial<Prescription> = {}) => ({ ...base, medicines, ...extra }) as Prescription;
const ids = (alerts: { id: string }[]) => alerts.map((a) => a.id.split(":")[0]);

describe("medicine names", () => {
  it("splits combination medicines and uses the brand list when generic is missing", () => {
    expect(ingredientsOf({ generic_name: "Amoxicillin + Clavulanic acid", brand_name: null })).toEqual(["amoxicillin", "clavulanic acid"]);
    expect(ingredientsOf({ generic_name: null, brand_name: "Brufen" })).toEqual(["ibuprofen"]);
    expect(ingredientsOf({ generic_name: "Co-amoxiclav", brand_name: null })).toEqual(["amoxicillin", "clavulanic acid"]);
  });
  it("matches groups by whole word only", () => {
    expect(matchesTerm("diclofenac sodium", "@nsaid")).toBe(true);
    expect(matchesTerm("esomeprazole", "omeprazole")).toBe(false);
    expect(coreName("losartan potassium")).toBe("losartan");
    expect(coreName("potassium chloride")).toBe("potassium chloride");
  });
  it("treats creams and eye drops as non-systemic", () => {
    expect(isSystemic({ route: "topical", dosage_form: "gel" })).toBe(false);
    expect(isSystemic({ route: null, dosage_form: "eye drops" })).toBe(false);
    expect(isSystemic({ route: "oral", dosage_form: "syrup" })).toBe(true);
  });
});

describe("duplicate-generic detection", () => {
  it("finds the same salt under two brands", () => {
    const d = findDuplicates(rxWith([med({ brand_name: "Panadol", generic_name: "Paracetamol" }), med({ brand_name: "Calpol", generic_name: "Paracetamol" })]));
    expect(d).toHaveLength(1);
    expect(d[0].severity).toBe("major");
    expect(d[0].whatHappens).toMatch(/liver/);
  });
  it("finds a salt shared with a combination product", () => {
    const d = findDuplicates(rxWith([med({ brand_name: "Panadol", generic_name: "Paracetamol" }), med({ brand_name: "Panadol Extra", generic_name: "Paracetamol + Caffeine" })]));
    expect(d).toHaveLength(1);
  });
  it("ignores salt-form differences (diclofenac sodium vs potassium)", () => {
    const d = findDuplicates(rxWith([med({ brand_name: "Voren", generic_name: "Diclofenac sodium" }), med({ brand_name: "Dicloran", generic_name: "Diclofenac potassium" })]));
    expect(d).toHaveLength(1);
  });
  it("flags two different NSAIDs once, as a group duplicate", () => {
    const d = findDuplicates(rxWith([med({ brand_name: "Brufen", generic_name: "Ibuprofen" }), med({ brand_name: "Ponstan", generic_name: "Mefenamic acid" })]));
    expect(d.map((a) => a.id.split(":")[0])).toEqual(["dupgroup"]);
  });
  it("does not flag a gel plus a tablet of the same medicine", () => {
    const d = findDuplicates(rxWith([med({ generic_name: "Diclofenac", brand_name: "Voren" }), med({ generic_name: "Diclofenac", brand_name: "Voren gel", route: "topical", dosage_form: "gel" })]));
    expect(d).toHaveLength(0);
  });
  it("finds nothing in an ordinary prescription", () => {
    expect(findDuplicates(base)).toEqual([]);
  });
});

describe("local safety check (elderly patient, 9 medicines)", () => {
  const alerts = localSafetyCheck(elderly);
  const has = (prefix: string) => alerts.some((a) => a.id.startsWith(prefix));

  it("finds the known dangerous interactions", () => {
    expect(has("warfarin-nsaid")).toBe(true);
    expect(has("clopidogrel-ppi")).toBe(true);
    expect(has("clopidogrel-nsaid")).toBe(true);
    expect(has("fq-cation")).toBe(true);
    expect(has("warfarin-fq")).toBe(true);
  });
  it("finds disease, duplicate, age, allergy and antibiotic problems", () => {
    expect(has("nsaid-ulcer")).toBe(true); // "acidity" in diagnosis
    expect(has("dup")).toBe(true); // Panadol + Panadol Extra
    expect(has("age")).toBe(true); // NSAID at 72
    expect(alerts.find((a) => a.type === "allergy")?.drugs).toEqual(["Augmentin"]); // penicillin allergy
    expect(alerts.find((a) => a.id.startsWith("abx"))?.drugs).toEqual(["Novidat"]); // cipro with no duration
  });
  it("puts the most serious first", () => {
    const ranks = alerts.map((a) => ({ major: 0, moderate: 1, minor: 2 })[a.severity]);
    expect(ranks).toEqual([...ranks].sort());
  });
  it("finds no drug-drug interactions in an ordinary prescription", () => {
    expect(localSafetyCheck(base).filter((a) => a.type === "drug-drug")).toEqual([]);
  });
  it("ignores interactions with creams", () => {
    const r = rxWith([med({ brand_name: "Coumadin", generic_name: "Warfarin" }), med({ brand_name: "Voltaren gel", generic_name: "Diclofenac", route: "topical", dosage_form: "gel" })]);
    expect(ids(localSafetyCheck(r))).not.toContain("warfarin-nsaid");
  });
});

describe("dose and age checks", () => {
  it("reads ages, weights and strengths", () => {
    expect(parseAgeYears("45 years")).toBe(45);
    expect(parseAgeYears("6 months")).toBe(0.5);
    expect(parseAgeYears("۷ سال")).toBe(7);
    expect(parseWeightKg("18 kg")).toBe(18);
    expect(parseStrength("1 g")).toEqual({ mg: 1000 });
    expect(parseStrength("250 mg/5 ml")).toEqual({ mg: 250, perMl: 5 });
    expect(parseStrength("500/125 mg")).toBeNull();
  });
  it("calculates mg per dose and per day", () => {
    const syrup = med({ strength: "120 mg/5 ml", dose_per_time: "1 tsp", times_per_day: 3, dosage_form: "syrup" });
    expect(mgPerDose(syrup)).toBe(120);
    expect(mgPerDay(syrup)).toBe(360);
  });
  it("flags an adult dose above the usual maximum", () => {
    const r = rxWith([med({ brand_name: "Panadol", generic_name: "Paracetamol", strength: "500 mg", dose_per_time: "2 tablets", times_per_day: 6 })]);
    const a = localSafetyCheck(r).find((x) => x.id.startsWith("dose"));
    expect(a?.severity).toBe("major");
    expect(a?.whatHappens).toMatch(/6000 mg/);
  });
  it("checks a child's syrup dose against weight", () => {
    const child = { ...base.patient, age: { value: "4 years", confidence: "high" as const }, weight: { value: "15 kg", confidence: "high" as const } };
    const ok = rxWith([med({ brand_name: "Calpol", generic_name: "Paracetamol", strength: "120 mg/5 ml", dose_per_time: "7.5 ml", times_per_day: 3, dosage_form: "syrup", duration_days: 3 })], { patient: child });
    expect(localSafetyCheck(ok).filter((a) => a.type === "dose-check")).toEqual([]); // 180 mg = 12 mg/kg
    const high = rxWith([med({ brand_name: "Calpol", generic_name: "Paracetamol", strength: "250 mg/5 ml", dose_per_time: "10 ml", times_per_day: 4, dosage_form: "syrup", duration_days: 3 })], { patient: child });
    expect(localSafetyCheck(high).find((a) => a.type === "dose-check")?.severity).toBe("major"); // 500 mg per dose
  });
  it("asks for a weight when a child's weight is missing", () => {
    const child = { ...base.patient, age: { value: "4 years", confidence: "high" as const }, weight: { value: null, confidence: "low" as const } };
    const r = rxWith([med({ brand_name: "Calpol", generic_name: "Paracetamol", strength: "120 mg/5 ml", dose_per_time: "5 ml", times_per_day: 3, duration_days: 3 })], { patient: child });
    expect(localSafetyCheck(r).find((a) => a.type === "dose-check")?.whatHappens).toMatch(/weight/);
  });
  it("warns about aspirin in a child and ciprofloxacin under 18", () => {
    const teen = { ...base.patient, age: { value: "14 years", confidence: "high" as const } };
    const r = rxWith([med({ brand_name: "Disprin", generic_name: "Aspirin", strength: "300 mg", duration_days: 3 }), med({ brand_name: "Novidat", generic_name: "Ciprofloxacin", strength: "250 mg", duration_days: 5 })], { patient: teen });
    expect(localSafetyCheck(r).filter((a) => a.type === "age-check").map((a) => a.severity)).toEqual(["major", "moderate"]);
  });
});

describe("advice safety net", () => {
  it.each([
    "Stop taking the calcium while on the antibiotic.",
    "Do not take ibuprofen.",
    "Reduce the dose of warfarin.",
    "Switch to paracetamol.",
    "Skip a dose if you feel dizzy.",
  ])("replaces '%s'", (text) => {
    expect(safeAdvice(text)).toMatch(/talk to your doctor or pharmacist/i);
  });
  it.each(["Do not drink alcohol during the course.", "Take them 2 hours apart.", "Ask your doctor before taking these together."])("keeps '%s'", (text) => {
    expect(safeAdvice(text)).toBe(text);
  });
});

describe("merging with the AI", () => {
  const ai = AiInteractions.parse(aiElderly);
  const report = mergeReports(elderly, localSafetyCheck(elderly), ai);

  it("joins alerts both checks found, keeping one", () => {
    const wn = report.alerts.filter((a) => a.type === "drug-drug" && a.drugs.includes("Coumadin") && a.drugs.includes("Brufen"));
    expect(wn).toHaveLength(1);
    expect(wn[0].sources).toEqual(["local", "ai"]);
  });
  it("marks warfarin + clopidogrel as found by both", () => {
    const wc = report.alerts.find((a) => a.drugs.includes("Coumadin") && a.drugs.includes("Lowplat"));
    expect(wc?.sources).toEqual(["local", "ai"]);
    expect(wc?.severity).toBe("major");
  });
  it("merges the AI's allergy finding with ours", () => {
    expect(report.alerts.filter((a) => a.drugs.join() === "Augmentin" && (a.type === "allergy" || a.type === "drug-disease"))).toHaveLength(1);
  });
  it("cleans unsafe AI advice", () => {
    const calcium = report.alerts.find((a) => a.id.startsWith("fq-cation"));
    expect(calcium?.sources).toContain("ai");
    expect(report.alerts.every((a) => !/stop taking/i.test(a.whatToDo))).toBe(true);
  });
  it("keeps working without the AI", () => {
    const offline = mergeReports(elderly, localSafetyCheck(elderly), null);
    expect(offline.aiChecked).toBe(false);
    expect(offline.alerts.length).toBeGreaterThan(5);
  });
});

describe("AI-only findings", () => {
  it("are added as their own alerts", () => {
    const ai = AiInteractions.parse({
      interactions: [{ type: "drug-drug", drugs_involved: ["Risek", "Rigix"], severity: "minor", what_happens: "Example.", what_to_do: "Ask your pharmacist.", confidence: "low" }],
      age_specific_warnings: [], pregnancy_breastfeeding_note: null, no_interactions_found: false,
    });
    const r = mergeReports(base, localSafetyCheck(base), ai);
    const x = r.alerts.find((a) => a.sources.join() === "ai");
    expect(x?.drugs).toEqual(["Risek", "Rigix"]);
    expect(x?.medIndexes).toEqual([2, 3]);
  });
});

describe("advice safety net vs the pharmacy's own rules", () => {
  it("never rewrites any rule in data/interactions.json", async () => {
    const { rules } = (await import("@/data/interactions.json")).default as { rules: { id: string; what_to_do: string }[] };
    const changed = rules.filter((r) => safeAdvice(r.what_to_do) !== r.what_to_do).map((r) => r.id);
    expect(changed).toEqual([]);
  });
  it("still keeps the dose limit wording", () => {
    const t = "Avoid alcohol and do not take more than the dose on the prescription.";
    expect(safeAdvice(t)).toBe(t);
  });
});
