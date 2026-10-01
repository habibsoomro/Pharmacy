import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fillPrompt } from "@/lib/ai/prompts";

const cache = new Map<string, string>();

/** Load a prompt from /prompts and fill in {{PLACEHOLDERS}}. */
export function loadPrompt(name: string, vars: Record<string, string | number> = {}): string {
  let text = cache.get(name);
  if (text === undefined) {
    text = readFileSync(path.join(process.cwd(), "prompts", name), "utf8");
    // Re-read on every request while developing, so prompt edits show up immediately.
    if (process.env.NODE_ENV === "production") cache.set(name, text);
  }
  return fillPrompt(text, vars);
}
