import groupData from "@/data/drug-groups.json";
import type { Medicine } from "@/lib/schemas/extraction";
import { lookupGeneric } from "@/lib/rx/checks";

/** Different names for the same medicine (British/American, old/new spellings). */
export const SYNONYMS: [RegExp, string][] = [
  [/co-?amoxiclav/g, "amoxicillin + clavulanic acid"],
  [/co-?trimoxazole/g, "sulfamethoxazole + trimethoprim"],
  [/acetaminophen/g, "paracetamol"],
  [/albuterol/g, "salbutamol"],
  [/amoxycillin/g, "amoxicillin"],
  [/frusemide/g, "furosemide"],
  [/cephradine/g, "cefradine"],
  [/cephalexin/g, "cefalexin"],
  [/glyburide/g, "glibenclamide"],
  [/valproic acid|divalproex/g, "valproate"],
  [/scopolamine/g, "hyoscine"],
  [/sulph/g, "sulf"],
  [/aluminum/g, "aluminium"],
];

const GROUPS = groupData.groups as Record<string, string[]>;
const SALT_WORDS = new Set(["sodium", "potassium", "hydrochloride", "hcl", "besylate", "besilate", "maleate", "mesylate", "succinate", "tartrate", "trihydrate", "monohydrate", "dihydrate", "hyclate", "calcium"]);

export function normalizeGeneric(text: string): string {
  return SYNONYMS.reduce((acc, [re, to]) => acc.replace(re, to), text.toLowerCase());
}

/** "Amoxicillin + Clavulanic acid" → ["amoxicillin", "clavulanic acid"] */
export function ingredientsOf(med: Pick<Medicine, "generic_name" | "brand_name">): string[] {
  const generic = med.generic_name ?? lookupGeneric(med.brand_name);
  if (!generic) return [];
  return normalizeGeneric(generic)
    .replace(/\(.*?\)/g, " ")
    .split(/\s*(?:\+|\/|,|&|\band\b|\bwith\b)\s*/)
    .map((s) => s.replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 2);
}

/** "diclofenac sodium" → "diclofenac"; "potassium chloride" stays. Used to spot the same medicine twice. */
export function coreName(ingredient: string): string {
  const words = ingredient.split(" ");
  while (words.length > 1 && SALT_WORDS.has(words[words.length - 1])) words.pop();
  return words.join(" ");
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function hasWord(text: string, word: string): boolean {
  return new RegExp(`(^|[^a-z])${escape(word)}([^a-z]|$)`).test(text);
}

/** Does this ingredient match a term? Terms are generic names or "@group" names. */
export function matchesTerm(ingredient: string, term: string): boolean {
  if (term.startsWith("@")) {
    const words = GROUPS[term.slice(1)];
    if (!words) throw new Error(`Unknown medicine group ${term}`);
    return words.some((w) => hasWord(ingredient, normalizeGeneric(w)));
  }
  return hasWord(ingredient, normalizeGeneric(term));
}

export function medMatches(ingredients: string[], terms: string[]): boolean {
  return ingredients.some((ing) => terms.some((t) => matchesTerm(ing, t)));
}

const NON_SYSTEMIC_ROUTES = /topical|skin|eye|ophthalm|ear|otic|nasal|nose|inhal|mouth ?wash|gargle|vaginal|rectal/;
const NON_SYSTEMIC_FORMS = /cream|ointment|oint|gel|lotion|eye drop|ear drop|nasal|spray|inhaler|gargle|mouthwash|suppositor|pessar/;

/** Creams, eye/ear drops and inhalers mostly stay where they are put, so they don't join most interactions. */
export function isSystemic(med: Pick<Medicine, "route" | "dosage_form">): boolean {
  const route = (med.route ?? "").toLowerCase();
  if (route && NON_SYSTEMIC_ROUTES.test(route)) return false;
  if (!route || route === "oral") {
    const form = (med.dosage_form ?? "").toLowerCase();
    if (NON_SYSTEMIC_FORMS.test(form)) return false;
  }
  return true;
}

export function displayName(med: Pick<Medicine, "brand_name" | "generic_name">): string {
  return med.brand_name ?? med.generic_name ?? "Unnamed medicine";
}
