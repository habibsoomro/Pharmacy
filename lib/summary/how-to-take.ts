import type { Medicine } from "@/lib/schemas/extraction";

export type HowTo =
  | "swallow" | "dissolve" | "chew" | "liquid" | "eye" | "ear" | "nose" | "skin" | "inhale"
  | "injection" | "sachet" | "gargle" | "suppository" | "underTongue" | "asDirected";

/** Plain "how to take it" instructions from the form and route. Shaking is added for suspensions. */
export function howToTake(med: Pick<Medicine, "dosage_form" | "route" | "special_instructions">): { how: HowTo; shake: boolean } {
  const f = `${med.dosage_form ?? ""} ${med.route ?? ""} ${med.special_instructions ?? ""}`.toLowerCase();
  const shake = /suspension|susp\b|dry syrup/.test(f);
  const how: HowTo =
    /eye|ophthalm/.test(f) ? "eye"
    : /\bear\b|otic/.test(f) ? "ear"
    : /nasal|nose/.test(f) ? "nose"
    : /inhal|puff|rotacap/.test(f) ? "inhale"
    : /inj|vial|ampoule|\biv\b|\bim\b/.test(f) ? "injection"
    : /cream|ointment|oint|gel|lotion|topical|skin/.test(f) ? "skin"
    : /gargle|mouthwash/.test(f) ? "gargle"
    : /suppositor|rectal|pessar|vaginal/.test(f) ? "suppository"
    : /sublingual|under the tongue/.test(f) ? "underTongue"
    : /sachet|granule|powder/.test(f) && !shake ? "sachet"
    : /effervescent|dispersible|dissolve/.test(f) ? "dissolve"
    : /chew/.test(f) ? "chew"
    : /syrup|suspension|susp|liquid|elixir|drops|solution/.test(f) ? "liquid"
    : /tab|cap|pill/.test(f) ? "swallow"
    : "asDirected";
  return { how, shake };
}
