import { z } from "zod";
import { SUMMARY_LANGS } from "@/lib/languages";

/** What the browser sends to /api/translate. */
export const TranslateRequest = z.object({
  // English is allowed only so the request shape is simple; the browser never asks for it.
  target: z.enum(SUMMARY_LANGS).refine((l) => l !== "en"),
  level: z.enum(["simple", "detailed", "ui"]),
  texts: z.array(z.string().min(1).max(2000)).min(1).max(80),
});
export type TranslateRequest = z.infer<typeof TranslateRequest>;

/** What the AI must return: one translation per text, in the same order. */
export const translationsFor = (count: number) => z.object({ translations: z.array(z.string()).length(count) });

export type TranslateResponse = { ok: true; translations: string[] } | { ok: false; error: string };
