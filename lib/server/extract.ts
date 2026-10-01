import "server-only";
import { AI_MAX_TOKENS } from "@/config/ai";
import { AIError, type ContentBlock } from "@/lib/server/anthropic";
import { askForJson, InvalidOutputError, validateJson } from "@/lib/server/ask-json";
import { loadPrompt } from "@/lib/server/prompts";
import { extractVars } from "@/lib/ai/prompts";
import { mockSample } from "@/lib/server/mock";
import { crossCheck } from "@/lib/rx/checks";
import { ExtractionResult, type CheckWarning, type ExtractRequest } from "@/lib/schemas/extraction";

export { AIError, InvalidOutputError };

/** Read prescription photos with Claude, check the answer (retrying once if unusable), then double-check it ourselves. */
export async function extractPrescription(req: ExtractRequest): Promise<{ result: ExtractionResult; checks: CheckWarning[] }> {
  let result: ExtractionResult;

  if (process.env.AI_MOCK) {
    // Test mode: no API call (see lib/server/mock.ts for the samples).
    await new Promise((r) => setTimeout(r, 2500));
    const v = validateJson(JSON.stringify(mockSample().extraction), ExtractionResult);
    if (!v.ok) throw new InvalidOutputError(v.problems);
    result = v.value;
  } else {
    const vars = extractVars(new Date().toISOString().slice(0, 10), req.images.length);
    const system = loadPrompt("extract-system.md", vars);
    const content: ContentBlock[] = [
      ...req.images.map((img): ContentBlock => ({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } })),
      { type: "text", text: loadPrompt("extract-user.md", vars) },
    ];
    result = await askForJson({ system, content, schema: ExtractionResult, maxTokens: AI_MAX_TOKENS.extract });
  }

  if (!result.is_prescription) return { result, checks: [] };
  const { prescription, checks } = crossCheck(result);
  return { result: prescription, checks };
}
