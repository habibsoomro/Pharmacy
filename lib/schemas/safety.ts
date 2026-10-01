import { z } from "zod";
import { Confidence } from "@/lib/schemas/extraction";

export const Severity = z.enum(["major", "moderate", "minor"]);
export type Severity = z.infer<typeof Severity>;

export const AlertType = z.enum(["drug-drug", "drug-food", "drug-disease", "duplicate-therapy", "dose-check", "age-check", "allergy"]);
export type AlertType = z.infer<typeof AlertType>;

const lower = (v: unknown) => (typeof v === "string" ? v.toLowerCase().trim() : v);
const text = z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : null), z.string().nullable());

/** What the AI must return from /api/interactions. */
export const AiInteractions = z.object({
  interactions: z.array(
    z.object({
      type: z.preprocess(lower, AlertType).catch("drug-drug"),
      drugs_involved: z.array(z.string()).catch([]),
      severity: z.preprocess(lower, Severity).catch("moderate"),
      what_happens: z.string().min(1),
      what_to_do: z.string().min(1),
      confidence: z.preprocess(lower, Confidence).catch("low"),
    }),
  ),
  age_specific_warnings: z.array(z.string()).catch([]),
  pregnancy_breastfeeding_note: text.catch(null),
  no_interactions_found: z.boolean().catch(false),
});
export type AiInteractions = z.infer<typeof AiInteractions>;

/** What the browser sends to /api/interactions (only what's needed; no names or phone numbers). */
const short = z.string().max(200).nullable();
export const InteractionRequest = z.object({
  medicines: z
    .array(
      z.object({
        name: short, generic: short, strength: short, dose: short, frequency: short,
        times_per_day: z.number().nullable(), duration_days: z.number().nullable(), route: short, form: short,
      }),
    )
    .min(1)
    .max(20),
  patient: z.object({ age: short, sex: short, weight: short }),
  diagnosis: z.string().max(1000).nullable(),
  allergies: short,
});
export type InteractionRequest = z.infer<typeof InteractionRequest>;

export type InteractionResponse = { ok: true; ai: AiInteractions } | { ok: false; error: string };

/** One alert shown to the person, from our own list, the AI, or both. */
export type SafetyAlert = {
  id: string;
  type: AlertType;
  severity: Severity;
  drugs: string[]; // display names
  medIndexes: number[]; // which medicines on the prescription
  whatHappens: string;
  whatToDo: string;
  sources: ("local" | "ai")[];
  confidence?: Confidence;
};

export type SafetyReport = {
  alerts: SafetyAlert[];
  ageWarnings: string[];
  pregnancyNote: string | null;
  aiChecked: boolean; // false if the AI check failed and only the local list was used
  checkedAt: string;
};
