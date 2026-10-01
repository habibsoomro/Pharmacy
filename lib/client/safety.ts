import type { Prescription } from "@/lib/schemas/extraction";
import { AiInteractions, type InteractionRequest, type SafetyReport } from "@/lib/schemas/safety";
import { aiTransport } from "@/lib/client/ai-transport";
import { localSafetyCheck, mergeReports } from "@/lib/rx/safety";

/** Only what the safety check needs. No patient name, phone or address is sent. */
export function buildInteractionRequest(rx: Prescription): InteractionRequest {
  const cut = (s: string | null) => (s ? s.slice(0, 200) : null);
  return {
    medicines: rx.medicines.slice(0, 20).map((m) => ({
      name: cut(m.brand_name), generic: cut(m.generic_name), strength: cut(m.strength), dose: cut(m.dose_per_time),
      frequency: cut(m.frequency_text), times_per_day: m.times_per_day, duration_days: m.duration_days, route: cut(m.route), form: cut(m.dosage_form),
    })),
    patient: { age: cut(rx.patient.age.value), sex: cut(rx.patient.sex.value), weight: cut(rx.patient.weight.value) },
    diagnosis: rx.clinical.diagnosis_or_complaints.value?.slice(0, 1000) ?? null,
    allergies: cut(rx.clinical.allergies_mentioned.value),
  };
}

/** A fingerprint of the inputs, so we only re-check when something changed. */
export function safetyKey(rx: Prescription): string {
  return JSON.stringify(buildInteractionRequest(rx));
}

/** Our own checks only (instant, works offline). */
export function localReport(rx: Prescription): SafetyReport {
  return mergeReports(rx, localSafetyCheck(rx), null);
}

/** Our own checks + the AI check, merged. Falls back to our own checks if the AI isn't reachable. */
export async function fullSafetyCheck(rx: Prescription): Promise<SafetyReport> {
  const local = localSafetyCheck(rx);
  if (!rx.medicines.length) return mergeReports(rx, local, null);
  let ai: AiInteractions | null = null;
  try {
    if (navigator.onLine) {
      const { data } = await aiTransport.interactions(buildInteractionRequest(rx));
      if (data?.ok) {
        const parsed = AiInteractions.safeParse(data.ai);
        ai = parsed.success ? parsed.data : null;
      }
    }
  } catch {
    ai = null;
  }
  return mergeReports(rx, local, ai);
}
