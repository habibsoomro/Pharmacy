import "server-only";
import { AI_MAX_TOKENS } from "@/config/ai";
import { askForJson } from "@/lib/server/ask-json";
import { loadPrompt } from "@/lib/server/prompts";
import { interactionVars } from "@/lib/ai/prompts";
import { mockSample } from "@/lib/server/mock";
import { AiInteractions, type InteractionRequest } from "@/lib/schemas/safety";

export function buildInteractionPrompt(req: InteractionRequest): string {
  return loadPrompt("interactions-user.md", interactionVars(req));
}

export async function checkInteractions(req: InteractionRequest): Promise<AiInteractions> {
  if (process.env.AI_MOCK) {
    await new Promise((r) => setTimeout(r, 1500));
    return AiInteractions.parse(mockSample().safety);
  }
  return askForJson({
    system: loadPrompt("interactions-system.md"),
    content: buildInteractionPrompt(req),
    schema: AiInteractions,
    maxTokens: AI_MAX_TOKENS.interactions,
  });
}
