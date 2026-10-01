import careData from "@/data/care.json";
import type { Medicine } from "@/lib/schemas/extraction";
import type { SafetyReport } from "@/lib/schemas/safety";
import { displayName, ingredientsOf, medMatches } from "@/lib/rx/drugs";

type GroupCare = { side_effects?: string[]; urgent?: string[] };
const GROUPS = careData.groups as Record<string, GroupCare>;

export type CareInfo = {
  sideEffects: { name: string; items: string[] }[]; // per medicine
  avoid: string[]; // food and drink, from the safety check
  storage: string[];
  urgent: string[];
};

/** Everything for the General Care card, built from the medicines on this prescription. */
export function buildCare(meds: Medicine[], safety: SafetyReport | null): CareInfo {
  const sideEffects: CareInfo["sideEffects"] = [];
  const urgent = new Set<string>();
  const storage = new Set<string>();

  for (const med of meds) {
    const ing = ingredientsOf(med);
    const items = new Set<string>();
    for (const [group, info] of Object.entries(GROUPS)) {
      if (ing.length && medMatches(ing, [group])) {
        info.side_effects?.forEach((s) => items.add(s));
        info.urgent?.forEach((u) => urgent.add(u));
      }
    }
    if (items.size) sideEffects.push({ name: displayName(med), items: [...items].slice(0, 4) });
    const formText = `${med.dosage_form ?? ""} ${med.generic_name ?? ""}`.toLowerCase();
    for (const f of careData.forms) if (new RegExp(f.match).test(formText)) storage.add(f.storage);
  }

  const avoid = (safety?.alerts ?? []).filter((a) => a.type === "drug-food").map((a) => `${a.drugs.join(" + ")}: ${a.whatToDo}`);
  careData.general.storage.forEach((s) => storage.add(s));
  careData.general.urgent.forEach((u) => urgent.add(u));
  return { sideEffects, avoid, storage: [...storage], urgent: [...urgent] };
}
