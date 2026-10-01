import "server-only";
import { AI_MODEL, AI_TEMPERATURE, AI_TIMEOUT_SECONDS } from "@/config/ai";

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

export type ChatMessage = { role: "user" | "assistant"; content: string | ContentBlock[] };

export class AIError extends Error {
  constructor(public code: "not_configured" | "timeout" | "ai_failed" | "truncated", message?: string) {
    super(message ?? code);
  }
}

/** Send a request to Claude and return its text answer. Server-side only. */
export async function askClaude(opts: { system: string; messages: ChatMessage[]; maxTokens: number }): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AIError("not_configured", "ANTHROPIC_API_KEY is missing");

  const send = async (withTemperature: boolean) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_SECONDS * 1000);
    try {
      return await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: AI_MODEL,
          max_tokens: opts.maxTokens,
          system: opts.system,
          messages: opts.messages,
          ...(withTemperature && AI_TEMPERATURE !== null ? { temperature: AI_TEMPERATURE } : {}),
        }),
      });
    } catch (e) {
      if ((e as Error).name === "AbortError") throw new AIError("timeout");
      throw new AIError("ai_failed", "network error reaching Anthropic");
    } finally {
      clearTimeout(timer);
    }
  };

  let res = await send(true);
  if (res.status === 400) {
    const body = await res.clone().text();
    if (/temperature/i.test(body)) res = await send(false); // model doesn't accept temperature
  }
  if (!res.ok) {
    // Log the status only, never the prescription content.
    console.error(`[anthropic] request failed with status ${res.status}`);
    throw new AIError("ai_failed", `status ${res.status}`);
  }

  const data = (await res.json()) as { content?: { type: string; text?: string }[]; stop_reason?: string };
  if (data.stop_reason === "max_tokens") throw new AIError("truncated");
  return (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n");
}

/** Pull the JSON object out of the AI's reply (ignores stray text or ``` fences). */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new SyntaxError("No JSON object found");
  return JSON.parse(cleaned.slice(start, end + 1));
}
