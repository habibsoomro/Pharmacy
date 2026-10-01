import { z } from "zod";

/**
 * The shape the AI must return. Anything that doesn't match is rejected
 * (and the AI is asked once more). Small differences the AI often makes,
 * such as "2" instead of 2, are tidied up rather than rejected.
 */

export const Confidence = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof Confidence>;

// "" or "N/A" → null; numbers → text.
const text = z.preprocess((v) => {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    const s = v.trim();
    return s === "" || /^(n\/?a|null|none|unknown|-)$/i.test(s) ? null : s;
  }
  return v;
}, z.string().nullable());

// "2" → 2; "" / "unknown" → null.
const num = z.preprocess((v) => {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "string") {
    const n = Number(v.trim().replace("½", "0.5"));
    return Number.isFinite(n) ? n : null;
  }
  return v;
}, z.number().min(0).nullable());

const slot = z.preprocess((v) => (v === null || v === undefined || v === "" ? 0 : typeof v === "string" ? Number(v) || 0 : v), z.number().min(0).max(20));

const conf = z.preprocess((v) => (typeof v === "string" ? v.toLowerCase() : v), Confidence).catch("low");

/** A single piece of information plus how sure the AI is about it. */
export const Field = z.preprocess(
  // Accept a bare value too ("Dr Ali") and treat it as low confidence.
  (v) => (v !== null && typeof v === "object" ? v : { value: v, confidence: "low" }),
  z.object({ value: text, confidence: conf }),
);
export type Field = z.infer<typeof Field>;
const emptyField = (): Field => ({ value: null, confidence: "low" });
const field = Field.catch(emptyField);

export const FoodTiming = z.enum(["before meal", "after meal", "with meal", "empty stomach", "any"]);

export const Medicine = z.object({
  brand_name: text,
  generic_name: text,
  brand_mapping_certain: z.boolean().catch(false),
  strength: text,
  dosage_form: text,
  dose_per_time: text,
  frequency_text: text,
  times_per_day: num,
  schedule: z
    .object({ morning: slot, afternoon: slot, evening: slot, night: slot })
    .catch({ morning: 0, afternoon: 0, evening: 0, night: 0 }),
  route: text,
  food_timing: z.preprocess((v) => (typeof v === "string" ? v.toLowerCase().trim() : v), FoodTiming.nullable()).catch(null),
  duration_days: num,
  duration_text: text,
  total_quantity_needed: text,
  special_instructions: text,
  purpose_in_simple_words: text,
  confidence: conf,
  uncertain_fields: z.array(z.string()).catch([]),
});
export type Medicine = z.infer<typeof Medicine>;

export const Prescription = z.object({
  is_prescription: z.literal(true),
  prescription_date: field,
  doctor: z.object({
    name: field,
    qualifications: field,
    specialty: field,
    registration_no: field,
    clinic_or_hospital: field,
    address: field,
    phone: field,
  }),
  patient: z.object({
    name: field,
    age: field,
    sex: field,
    weight: field,
    address: field,
    phone: field,
    mr_or_file_no: field,
  }),
  clinical: z.object({
    diagnosis_or_complaints: field,
    vitals: z
      .object({ blood_pressure: field, pulse: field, temperature: field, other: field })
      .catch({ blood_pressure: emptyField(), pulse: emptyField(), temperature: emptyField(), other: emptyField() }),
    tests_advised: z.array(z.string()).catch([]),
    allergies_mentioned: field,
    follow_up_date: field,
    other_advice: field,
  }),
  medicines: z.array(Medicine),
  unreadable_fields: z.array(z.string()).catch([]),
  overall_legibility: z.preprocess((v) => (typeof v === "string" ? v.toLowerCase() : v), z.enum(["good", "fair", "poor"])).catch("poor"),
});
export type Prescription = z.infer<typeof Prescription>;

export const NotPrescription = z.object({
  is_prescription: z.literal(false),
  reason: text.optional(),
});

export const ExtractionResult = z.discriminatedUnion("is_prescription", [Prescription, NotPrescription]);
export type ExtractionResult = z.infer<typeof ExtractionResult>;

/* ------------------------------------------------------------------ */
/* What the browser sends to /api/extract                              */
/* ------------------------------------------------------------------ */

// About 3 MB of base64 per page; real compressed pages are ~150 KB.
const MAX_BASE64_PER_IMAGE = 3_000_000;

export const ExtractRequest = z.object({
  images: z
    .array(
      z.object({
        mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        base64: z.string().min(100).max(MAX_BASE64_PER_IMAGE).regex(/^[A-Za-z0-9+/=]+$/),
      }),
    )
    .min(1)
    .max(4),
});
export type ExtractRequest = z.infer<typeof ExtractRequest>;

/* ------------------------------------------------------------------ */
/* What /api/extract sends back                                        */
/* ------------------------------------------------------------------ */

/** A mismatch between what the AI read and our own shorthand check. */
export type CheckWarning = {
  medicineIndex: number;
  field: "times_per_day" | "duration_days" | "total_quantity_needed" | "generic_name";
  aiValue: string | null;
  expected: string;
  message: string;
};

export type ExtractErrorCode = "bad_request" | "rate_limited" | "ai_failed" | "invalid_output" | "not_configured" | "timeout";

export type ExtractResponse =
  | { ok: true; result: ExtractionResult; checks: CheckWarning[] }
  | { ok: false; error: ExtractErrorCode };
