import type { ZodType } from "zod";

/** Pull the JSON object out of the AI's reply (ignores stray text or ``` fences). */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new SyntaxError("No JSON object found");
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** Check a reply against a schema; on failure, list the problems so the AI can be asked to fix them. */
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
