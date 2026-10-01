import "server-only";
import { AI_MAX_TOKENS } from "@/config/ai";
import { askForJson } from "@/lib/server/ask-json";
import { loadPrompt } from "@/lib/server/prompts";
import { translateVars } from "@/lib/ai/prompts";
import { translationsFor, type TranslateRequest } from "@/lib/schemas/translate";

export function buildTranslatePrompts(req: TranslateRequest): { system: string; user: string } {
  const vars = translateVars(req);
  return { system: loadPrompt("translate-system.md", vars.system), user: loadPrompt("translate-user.md", vars.user) };
}

/**
 * Website labels (level "ui") are the same for everybody, so they are remembered
 * on the server too. Prescription texts are NEVER kept on the server.
 */
const uiCache = new Map<string, string>();
const uiKey = (lang: string, text: string) => `${lang}\u0000${text}`;

export async function translateTexts(req: TranslateRequest): Promise<string[]> {
  if (process.env.AI_MOCK) {
    // Test mode: no AI call; mark the text so you can see where translations appear.
    await new Promise((r) => setTimeout(r, 800));
    return req.texts.map((t) => `[${req.target}] ${t}`);
  }

  const cached = req.level === "ui" ? req.texts.map((t) => uiCache.get(uiKey(req.target, t))) : [];
  if (req.level === "ui" && cached.every((c) => c !== undefined)) return cached as string[];

  const { system, user } = buildTranslatePrompts(req);
  const { translations } = await askForJson({
    system,
    content: user,
    schema: translationsFor(req.texts.length),
    maxTokens: AI_MAX_TOKENS.translate,
  });

  if (req.level === "ui") {
    if (uiCache.size > 5000) uiCache.clear();
    req.texts.forEach((t, i) => uiCache.set(uiKey(req.target, t), translations[i]));
  }
  return translations;
}
