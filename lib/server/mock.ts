import "server-only";
import handwritten from "@/tests/fixtures/extraction-handwritten.json";
import elderly from "@/tests/fixtures/extraction-elderly.json";
import printed from "@/tests/fixtures/extraction-printed.json";
import child from "@/tests/fixtures/extraction-child.json";
import notPrescription from "@/tests/fixtures/extraction-not-prescription.json";
import handwrittenSafety from "@/tests/fixtures/interactions-handwritten.json";
import elderlySafety from "@/tests/fixtures/interactions-elderly.json";
import printedSafety from "@/tests/fixtures/interactions-printed.json";
import childSafety from "@/tests/fixtures/interactions-child.json";

/**
 * Test mode (AI_MOCK in .env.local): every scan returns one sample prescription
 * instead of calling the AI. Choose which with:
 *   AI_MOCK=1 (or handwritten)  messy handwriting, 5 medicines
 *   AI_MOCK=printed             clean printed prescription, diabetes and blood pressure
 *   AI_MOCK=child               4-year-old with syrups in ml (one dose too high for the weight)
 *   AI_MOCK=elderly             72-year-old on 9 medicines with serious interactions
 *   AI_MOCK=notrx               a photo that is not a prescription
 */
const SAMPLES = {
  handwritten: { extraction: handwritten, safety: handwrittenSafety },
  printed: { extraction: printed, safety: printedSafety },
  child: { extraction: child, safety: childSafety },
  elderly: { extraction: elderly, safety: elderlySafety },
  notrx: { extraction: notPrescription, safety: handwrittenSafety },
} as const;

export function mockSample() {
  const name = process.env.AI_MOCK as keyof typeof SAMPLES;
  return SAMPLES[name] ?? SAMPLES.handwritten;
}
