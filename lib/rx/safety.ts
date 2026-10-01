import ruleData from "@/data/interactions.json";
import type { Prescription, Medicine } from "@/lib/schemas/extraction";
import type { AiInteractions, SafetyAlert, SafetyReport, Severity } from "@/lib/schemas/safety";
import { coreName, displayName, ingredientsOf, isSystemic, medMatches, matchesTerm } from "@/lib/rx/drugs";
import { mgPerDay, mgPerDose, parseAgeYears, parseWeightKg } from "@/lib/rx/dose";
import { parseDuration } from "@/lib/rx/shorthand";

/**
 * The pharmacy's own safety checks. These run in the browser, need no
 * internet, and are used alongside (and to double-check) the AI.
 */

type Rule = {
  id: string; type: "drug-drug" | "drug-food" | "drug-disease"; a: string[]; b?: string[]; condition?: string[];
  severity: Severity; what_happens: string; what_to_do: string;
};
const RULES = ruleData.rules as Rule[];

const SEVERITY_RANK: Record<Severity, number> = { major: 0, moderate: 1, minor: 2 };
const SAFE_ADVICE = "Talk to your doctor or pharmacist before making any change to your medicines.";

/**
 * Safety net: we never tell people to stop, skip or change a medicine themselves.
 * If any advice (ours or the AI's) does, it is replaced with "talk to your doctor".
 */
export function safeAdvice(text: string): string {
  const risky = /\b(stop|discontinue|quit|cease)\s+(taking|using|the|this|that|your|it|all)\b|\b(do not|don't|never)\s+(take|use|give)\b(?!\s+(more than|it with|them with|with|at the same time))|\bskip\s+(a|the|your|this)\s+dose|\b(reduce|increase|change|lower|raise|double|halve|adjust)\s+(the|your|this)\s+(dose|dosage)\b|\bswitch\s+to\b/i;
  return risky.test(text) ? SAFE_ADVICE : text;
}

type Med = { index: number; med: Medicine; name: string; ingredients: string[]; systemic: boolean };

function prepare(rx: Prescription): Med[] {
  return rx.medicines.map((med, index) => ({ index, med, name: displayName(med), ingredients: ingredientsOf(med), systemic: isSystemic(med) }));
}

function alert(id: string, type: SafetyAlert["type"], severity: Severity, meds: Med[], whatHappens: string, whatToDo: string): SafetyAlert {
  return {
    id, type, severity, drugs: meds.map((m) => m.name), medIndexes: meds.map((m) => m.index),
    whatHappens, whatToDo: safeAdvice(whatToDo), sources: ["local"],
  };
}

/* ------------------------- interactions ------------------------- */

function ruleAlerts(meds: Med[], rx: Prescription): SafetyAlert[] {
  const out: SafetyAlert[] = [];
  const sys = meds.filter((m) => m.systemic && m.ingredients.length);
  const conditionText = [rx.clinical.diagnosis_or_complaints.value, rx.clinical.other_advice.value].filter(Boolean).join(" ").toLowerCase();

  for (const r of RULES) {
    if (r.type === "drug-drug" && r.b) {
      for (let i = 0; i < sys.length; i++) {
        for (let j = i + 1; j < sys.length; j++) {
          const [x, y] = [sys[i], sys[j]];
          const hit = (medMatches(x.ingredients, r.a) && medMatches(y.ingredients, r.b)) || (medMatches(y.ingredients, r.a) && medMatches(x.ingredients, r.b));
          if (hit) out.push(alert(`${r.id}:${x.index}-${y.index}`, "drug-drug", r.severity, [x, y], r.what_happens, r.what_to_do));
        }
      }
    } else if (r.type === "drug-food") {
      const hits = sys.filter((m) => medMatches(m.ingredients, r.a));
      if (hits.length) out.push(alert(r.id, "drug-food", r.severity, hits, r.what_happens, r.what_to_do));
    } else if (r.type === "drug-disease" && r.condition && conditionText) {
      if (r.condition.some((c) => conditionText.includes(c))) {
        const hits = sys.filter((m) => medMatches(m.ingredients, r.a));
        if (hits.length) out.push(alert(r.id, "drug-disease", r.severity, hits, r.what_happens, r.what_to_do));
      }
    }
  }
  return out;
}

/* ------------------------- duplicates ------------------------- */

// Two DIFFERENT medicines from the same group that are rarely meant to be combined.
const GROUP_DUPLICATES: { group: string; severity: Severity; what: string }[] = [
  { group: "nsaid", severity: "major", what: "These are two anti-inflammatory pain medicines. Taking both adds risk (stomach bleeding, kidney strain) without extra benefit." },
  { group: "ssri", severity: "major", what: "These are two antidepressants of the same type. Together they can cause serotonin syndrome." },
  { group: "ppi", severity: "moderate", what: "These are two stomach-acid medicines that work the same way. One is usually enough." },
  { group: "benzodiazepine", severity: "moderate", what: "These are two sleeping/calming medicines of the same type. Together they cause extra drowsiness." },
  { group: "sedating_antihistamine", severity: "moderate", what: "These are two drowsy allergy medicines. Together they cause extra drowsiness." },
  { group: "sulfonylurea", severity: "moderate", what: "These are two diabetes medicines that work the same way, which raises the risk of low blood sugar." },
  { group: "statin", severity: "moderate", what: "These are two cholesterol medicines of the same type, which raises the risk of muscle problems." },
  { group: "beta_blocker", severity: "moderate", what: "These are two heart/blood-pressure medicines of the same type, which can slow the heart too much." },
];

/** Same medicine (same salt) under two names, e.g. Panadol + Calpol, or Panadol + Panadol Extra. */
export function findDuplicates(rx: Prescription): SafetyAlert[] {
  const meds = prepare(rx).filter((m) => m.ingredients.length);
  const out: SafetyAlert[] = [];
  const paired = new Set<string>();

  for (let i = 0; i < meds.length; i++) {
    for (let j = i + 1; j < meds.length; j++) {
      const [x, y] = [meds[i], meds[j]];
      if (x.systemic !== y.systemic) continue; // e.g. diclofenac gel + diclofenac tablet is often intended
      const shared = x.ingredients.map(coreName).filter((n) => y.ingredients.map(coreName).includes(n));
      if (shared.length) {
        paired.add(`${i}-${j}`);
        const salt = shared.join(" + ");
        const isParacetamol = shared.includes("paracetamol");
        out.push(alert(
          `dup:${x.index}-${y.index}`, "duplicate-therapy", isParacetamol || shared.some((s) => matchesTerm(s, "@nsaid")) ? "major" : "moderate", [x, y],
          `Both contain ${salt}. Taking both means a double dose${isParacetamol ? ", which can damage the liver" : ""}.`,
          "Show both medicines to your pharmacist to check whether you should take both.",
        ));
      }
    }
  }
  for (const g of GROUP_DUPLICATES) {
    const hits = meds.filter((m) => m.systemic && medMatches(m.ingredients, [`@${g.group}`]));
    for (let i = 0; i < hits.length; i++) {
      for (let j = i + 1; j < hits.length; j++) {
        const key = `${meds.indexOf(hits[i])}-${meds.indexOf(hits[j])}`;
        if (paired.has(key)) continue;
        out.push(alert(`dupgroup:${g.group}:${hits[i].index}-${hits[j].index}`, "duplicate-therapy", g.severity, [hits[i], hits[j]], g.what,
          "Ask your doctor or pharmacist whether you need both."));
      }
    }
  }
  return out;
}

/* ------------------------- dose, age, antibiotic, allergy ------------------------- */

// Usual maximum per day for adults (mg). Only clear, single-ingredient cases.
const ADULT_MAX_MG_PER_DAY: Record<string, number> = {
  paracetamol: 4000, ibuprofen: 3200, diclofenac: 150, "mefenamic acid": 1500, naproxen: 1500, tramadol: 400,
  glimepiride: 8, glibenclamide: 15, metformin: 3000, amlodipine: 10, atorvastatin: 80, losartan: 150,
  captopril: 150, enalapril: 40, ciprofloxacin: 1500, levofloxacin: 750, montelukast: 10, domperidone: 30,
  alprazolam: 4, cefixime: 400, cetirizine: 20,
};
// Children (under 12): usual maximum mg per kg.
const CHILD_MG_PER_KG: Record<string, { perDose: number; perDay: number }> = {
  paracetamol: { perDose: 15, perDay: 75 },
  ibuprofen: { perDose: 10, perDay: 40 },
};

const AGE_RULES: { terms: string[]; test: (age: number) => boolean; severity: Severity; what: string }[] = [
  { terms: ["@aspirin"], test: (a) => a < 16, severity: "major", what: "Aspirin is usually avoided in children and teenagers under 16 because of a rare but serious illness (Reye's syndrome)." },
  { terms: ["@tetracycline"], test: (a) => a < 8, severity: "major", what: "This antibiotic is usually avoided in children under 8 because it can permanently stain teeth." },
  { terms: ["@codeine", "@tramadol"], test: (a) => a < 12, severity: "major", what: "This pain medicine is usually avoided in children under 12 because it can slow their breathing." },
  { terms: ["@promethazine"], test: (a) => a < 2, severity: "major", what: "This medicine is not used in children under 2 because it can dangerously slow breathing." },
  { terms: ["@loperamide"], test: (a) => a < 2, severity: "major", what: "This diarrhoea medicine is not used in children under 2." },
  { terms: ["@metoclopramide"], test: (a) => a < 1, severity: "major", what: "This anti-sickness medicine is not used in babies under 1." },
  { terms: ["@fluoroquinolone"], test: (a) => a < 18, severity: "moderate", what: "This antibiotic is usually avoided under 18 unless there is a special reason, because it can affect joints and tendons." },
  { terms: ["@benzodiazepine"], test: (a) => a >= 65, severity: "moderate", what: "In older people this medicine can cause confusion, unsteadiness and falls." },
  { terms: ["@sedating_antihistamine"], test: (a) => a >= 65, severity: "moderate", what: "In older people this drowsy allergy medicine can cause confusion, dry mouth and falls." },
  { terms: ["@nsaid"], test: (a) => a >= 65, severity: "moderate", what: "In older people these pain medicines more often cause stomach bleeding and kidney problems." },
  { terms: ["glibenclamide"], test: (a) => a >= 65, severity: "moderate", what: "In older people this diabetes medicine can cause long-lasting low blood sugar." },
];

const ALLERGY_GROUPS: { words: RegExp; terms: string[] }[] = [
  { words: /penicillin|amoxi|augmentin|ampicillin/i, terms: ["@penicillin"] },
  { words: /sulf|sulph|septran|co-?trimoxazole/i, terms: ["@sulfonamide"] },
  { words: /nsaid|aspirin|ibuprofen|brufen|diclofenac|painkiller/i, terms: ["@nsaid", "@aspirin"] },
];

function doseAgeAlerts(meds: Med[], rx: Prescription): SafetyAlert[] {
  const out: SafetyAlert[] = [];
  const age = parseAgeYears(rx.patient.age);
  const weight = parseWeightKg(rx.patient.weight);
  const isChild = age !== null && age < 12;

  for (const m of meds) {
    if (!m.systemic || !m.ingredients.length) continue;
    const single = m.ingredients.length === 1 ? coreName(m.ingredients[0]) : null;

    // Dose check
    if (single) {
      const perDay = mgPerDay(m.med);
      const perDose = mgPerDose(m.med);
      const child = CHILD_MG_PER_KG[single];
      if (isChild && child) {
        if (weight && perDose !== null && perDose > child.perDose * weight * 1.1) {
          out.push(alert(`dose:${m.index}`, "dose-check", "major", [m],
            `Each dose (${Math.round(perDose)} mg) looks high for a child of ${weight} kg. The usual most is about ${Math.round(child.perDose * weight)} mg per dose.`,
            "Please confirm the dose with your pharmacist or doctor before giving it."));
        } else if (weight && perDay !== null && perDay > child.perDay * weight * 1.1) {
          out.push(alert(`dose:${m.index}`, "dose-check", "major", [m],
            `The daily amount (${Math.round(perDay)} mg) looks high for a child of ${weight} kg. The usual most is about ${Math.round(child.perDay * weight)} mg a day.`,
            "Please confirm the dose with your pharmacist or doctor before giving it."));
        } else if (!weight) {
          out.push(alert(`dose:${m.index}`, "dose-check", "minor", [m],
            "Children's doses depend on body weight, and no weight is written on the prescription.",
            "Ask your pharmacist to check the dose against the child's weight."));
        }
      } else if (!isChild && perDay !== null && ADULT_MAX_MG_PER_DAY[single] && perDay > ADULT_MAX_MG_PER_DAY[single]) {
        out.push(alert(`dose:${m.index}`, "dose-check", "major", [m],
          `This adds up to ${Math.round(perDay)} mg a day, which is more than the usual maximum of ${ADULT_MAX_MG_PER_DAY[single]} mg a day.`,
          "Please confirm the dose with your pharmacist or doctor."));
      }
    }

    // Age
    if (age !== null) {
      for (const r of AGE_RULES) {
        if (r.test(age) && medMatches(m.ingredients, r.terms)) {
          out.push(alert(`age:${m.index}:${r.terms[0]}`, "age-check", r.severity, [m], r.what, "Ask your doctor or pharmacist whether this medicine is right for this age."));
        }
      }
    }

    // Antibiotic with no number of days
    if (medMatches(m.ingredients, ["@antibiotic"]) && !m.med.duration_days && !parseDuration(m.med.duration_text)?.ongoing) {
      out.push(alert(`abx:${m.index}`, "dose-check", "moderate", [m],
        "No number of days is written for this antibiotic. Stopping antibiotics too early, or taking them too long, can cause problems.",
        "Ask your doctor or pharmacist how many days to take it."));
    }
  }

  // Allergies written on the prescription
  const allergy = rx.clinical.allergies_mentioned.value;
  if (allergy && !/^(nil|none|no|nkda|nka|no known.*)$/i.test(allergy.trim())) {
    for (const m of meds) {
      const byGroup = ALLERGY_GROUPS.some((g) => g.words.test(allergy) && medMatches(m.ingredients, g.terms));
      const byName = m.ingredients.some((i) => allergy.toLowerCase().includes(coreName(i))) || (m.med.brand_name && allergy.toLowerCase().includes(m.med.brand_name.toLowerCase()));
      if (byGroup || byName) {
        out.push(alert(`allergy:${m.index}`, "allergy", "major", [m],
          `The prescription mentions an allergy (${allergy}), and this medicine may belong to the same family.`,
          "Tell your doctor or pharmacist about this allergy before taking this medicine."));
      }
    }
  }
  return out;
}

/** All local checks for a prescription. */
export function localSafetyCheck(rx: Prescription): SafetyAlert[] {
  const meds = prepare(rx);
  return sortAlerts([...ruleAlerts(meds, rx), ...findDuplicates(rx), ...doseAgeAlerts(meds, rx)]);
}

export function sortAlerts(alerts: SafetyAlert[]): SafetyAlert[] {
  return [...alerts].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.sources.length - a.sources.length || a.medIndexes[0] - b.medIndexes[0],
  );
}

/* ------------------------- combining with the AI ------------------------- */

/** Work out which medicines on the prescription an AI alert is talking about. */
function resolveMeds(names: string[], meds: Med[]): number[] {
  const found = new Set<number>();
  for (const raw of names) {
    const n = raw.toLowerCase();
    for (const m of meds) {
      const brand = m.med.brand_name?.toLowerCase();
      if ((brand && (n.includes(brand) || brand.includes(n))) || m.ingredients.some((i) => n.includes(coreName(i)))) found.add(m.index);
    }
  }
  return [...found].sort((a, b) => a - b);
}

const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const FAMILY: Record<string, string> = { "age-check": "dose-check", allergy: "drug-disease" };
const family = (t: string) => FAMILY[t] ?? t;

/** Merge the local list with the AI answer. When both found the same thing, keep one alert marked "both". */
export function mergeReports(rx: Prescription, local: SafetyAlert[], ai: AiInteractions | null): SafetyReport {
  const meds = prepare(rx);
  const alerts = local.map((a) => ({ ...a, sources: [...a.sources] }));

  if (ai) {
    ai.interactions.forEach((x, k) => {
      const medIndexes = resolveMeds(x.drugs_involved, meds);
      const match = alerts.find((a) => family(a.type) === family(x.type) && medIndexes.length > 0 && sameSet([...a.medIndexes].sort((p, q) => p - q), medIndexes));
      if (match) {
        if (!match.sources.includes("ai")) match.sources.push("ai");
        if (SEVERITY_RANK[x.severity] < SEVERITY_RANK[match.severity]) match.severity = x.severity; // keep the more serious
        match.confidence = x.confidence;
      } else {
        alerts.push({
          id: `ai:${k}`, type: x.type, severity: x.severity,
          drugs: medIndexes.length ? medIndexes.map((i) => meds[i].name) : x.drugs_involved,
          medIndexes, whatHappens: x.what_happens, whatToDo: safeAdvice(x.what_to_do), sources: ["ai"], confidence: x.confidence,
        });
      }
    });
  }

  return {
    alerts: sortAlerts(alerts),
    ageWarnings: ai?.age_specific_warnings.map(safeAdvice) ?? [],
    pregnancyNote: ai?.pregnancy_breastfeeding_note ? safeAdvice(ai.pregnancy_breastfeeding_note) : null,
    aiChecked: ai !== null,
    checkedAt: new Date().toISOString(),
  };
}
