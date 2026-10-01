import "server-only";
import type { ZodType } from "zod";
import { askClaude, extractJson, type ChatMessage, type ContentBlock } from "@/lib/server/anthropic";
import { loadPrompt } from "@/lib/server/prompts";

export class InvalidOutputError extends Error {}

export function validateJson<T>(raw: string, schema: ZodType<T>): { ok: true; value: T } | { ok: false; problems: string } {
  let json: unknown;
  try {
    json = extractJson(raw);
  } catch {
    return { ok: false, problems: "- The reply was not valid JSON." };
  }
  const parsed = schema.safeParse(json);
  if (parsed.success) return { ok: true, value: parsed.data };
  return {
    ok: false,
    problems: parsed.error.issues.slice(0, 15).map((i) => `- ${i.path.join(".") || "(top level)"}: ${i.message}`).join("\n"),
  };
}

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
