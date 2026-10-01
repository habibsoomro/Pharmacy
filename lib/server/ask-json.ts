import "server-only";
import type { ZodType } from "zod";
import { askClaude, type ChatMessage, type ContentBlock } from "@/lib/server/anthropic";
import { validateJson } from "@/lib/ai/json";

export { validateJson };
import { loadPrompt } from "@/lib/server/prompts";

export class InvalidOutputError extends Error {}

/** Ask Claude for JSON matching `schema`. If the answer is unusable, ask once more explaining what was wrong. */
export async function askForJson<T>(opts: { system: string; content: ContentBlock[] | string; schema: ZodType<T>; maxTokens: number }): Promise<T> {
  const messages: ChatMessage[] = [{ role: "user", content: opts.content }];
  let raw = await askClaude({ system: opts.system, messages, maxTokens: opts.maxTokens });
  let result = validateJson(raw, opts.schema);
  if (!result.ok) {
    messages.push({ role: "assistant", content: raw }, { role: "user", content: loadPrompt("json-retry.md", { ERRORS: result.problems }) });
    raw = await askClaude({ system: opts.system, messages, maxTokens: opts.maxTokens });
    result = validateJson(raw, opts.schema);
  }
  if (!result.ok) throw new InvalidOutputError(result.problems);
  return result.value;
}
