import "server-only";
import mockHandwritten from "@/tests/fixtures/interactions-handwritten.json";
import mockElderly from "@/tests/fixtures/interactions-elderly.json";
import { AI_MAX_TOKENS } from "@/config/ai";
import { askForJson } from "@/lib/server/ask-json";
import { loadPrompt } from "@/lib/server/prompts";
import { AiInteractions, type InteractionRequest } from "@/lib/schemas/safety";

const or = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? "not written" : String(v));

export function buildInteractionPrompt(req: InteractionRequest): string {
  const medicines = req.medicines
    .map((m, i) =>
      `${i + 1}. ${or(m.name)} (generic: ${or(m.generic)}), strength ${or(m.strength)}, form ${or(m.form)}, route ${or(m.route)}, ` +
      `dose ${or(m.dose)}, frequency "${or(m.frequency)}" (${or(m.times_per_day)} times a day), duration ${m.duration_days ? `${m.duration_days} days` : "not written"}`,
    )
    .join("\n");
  return loadPrompt("interactions-user.md", {
    AGE: or(req.patient.age), SEX: or(req.patient.sex), WEIGHT: or(req.patient.weight),
    DIAGNOSIS: or(req.diagnosis), ALLERGIES: or(req.allergies), MEDICINES: medicines,
  });
}

export async function checkInteractions(req: InteractionRequest): Promise<AiInteractions> {
  if (process.env.AI_MOCK) {
    await new Promise((r) => setTimeout(r, 1500));
    return AiInteractions.parse(process.env.AI_MOCK === "elderly" ? mockElderly : mockHandwritten);
  }
  return askForJson({
    system: loadPrompt("interactions-system.md"),
    content: buildInteractionPrompt(req),
    schema: AiInteractions,
    maxTokens: AI_MAX_TOKENS.interactions,
  });
}
