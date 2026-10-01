import "server-only";
import brandData from "@/data/brand-generics.json";
import mockAnswer from "@/tests/fixtures/extraction-handwritten.json";
import { AI_MAX_TOKENS } from "@/config/ai";
import { AIError, askClaude, extractJson, type ChatMessage, type ContentBlock } from "@/lib/server/anthropic";
import { loadPrompt } from "@/lib/server/prompts";
import { crossCheck } from "@/lib/rx/checks";
import { ExtractionResult, type CheckWarning, type ExtractRequest } from "@/lib/schemas/extraction";

export class InvalidOutputError extends Error {}

const brandList = Object.entries(brandData.brands)
  .map(([b, g]) => `${b} = ${g}`)
  .join("; ");

function validate(raw: string): { ok: true; value: ExtractionResult } | { ok: false; problems: string } {
  let json: unknown;
  try {
    json = extractJson(raw);
  } catch {
    return { ok: false, problems: "- The reply was not valid JSON." };
  }
  const parsed = ExtractionResult.safeParse(json);
  if (parsed.success) return { ok: true, value: parsed.data };
  const problems = parsed.error.issues
    .slice(0, 15)
    .map((i) => `- ${i.path.join(".") || "(top level)"}: ${i.message}`)
    .join("\n");
  return { ok: false, problems };
}

/** Read prescription photos with Claude, check the answer, and retry once if it's unusable. */
export async function extractPrescription(req: ExtractRequest): Promise<{ result: ExtractionResult; checks: CheckWarning[] }> {
  let raw: string;
  const today = new Date().toISOString().slice(0, 10);

  if (process.env.AI_MOCK === "1") {
    // Test mode: no API call, returns a sample answer (see README).
    await new Promise((r) => setTimeout(r, 2500));
    raw = JSON.stringify(mockAnswer);
  } else {
    const system = loadPrompt("extract-system.md", { BRAND_LIST: brandList, TODAY: today });
    const content: ContentBlock[] = [
      ...req.images.map((img): ContentBlock => ({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } })),
      { type: "text", text: loadPrompt("extract-user.md", { PAGE_COUNT: req.images.length }) },
    ];
    const messages: ChatMessage[] = [{ role: "user", content }];

    raw = await askClaude({ system, messages, maxTokens: AI_MAX_TOKENS.extract });
    const first = validate(raw);
    if (!first.ok) {
      // One automatic retry, telling the AI exactly what was wrong.
      messages.push({ role: "assistant", content: raw }, { role: "user", content: loadPrompt("extract-retry.md", { ERRORS: first.problems }) });
      raw = await askClaude({ system, messages, maxTokens: AI_MAX_TOKENS.extract });
    }
  }

  const final = validate(raw);
  if (!final.ok) throw new InvalidOutputError(final.problems);

  if (!final.value.is_prescription) return { result: final.value, checks: [] };
  const { prescription, checks } = crossCheck(final.value);
  return { result: prescription, checks };
}

export { AIError };
