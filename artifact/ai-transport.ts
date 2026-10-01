/**
 * The version inside Claude has no server: the page asks Claude itself, on the
 * viewer's own Claude account (no API key). Same prompts, same answer checks
 * and same "ask once more if the answer is broken" rule as the website's server.
 */
import type { ZodType } from "zod";
import { useCapability } from "./claude";
import PROMPTS from "virtual:nuskha-prompts";
import { validateJson } from "@/lib/ai/json";
import { extractVars, fillPrompt, interactionVars, translateVars } from "@/lib/ai/prompts";
import { crossCheck } from "@/lib/rx/checks";
import { ExtractionResult, type ExtractRequest, type ExtractResponse } from "@/lib/schemas/extraction";
import { AiInteractions, type InteractionRequest, type InteractionResponse } from "@/lib/schemas/safety";
import { translationsFor, type TranslateRequest, type TranslateResponse } from "@/lib/schemas/translate";
import type { Answer } from "@/lib/client/ai-transport";

type Turn = { role: "user" | "assistant"; content: string };
type SampleFn = ((input: string | Turn[], opts?: Record<string, unknown>) => Promise<{ text: string; truncated: boolean }>) & {
  limits(): Promise<{ images?: { maxCount: number } }>;
};

let samplePromise: Promise<SampleFn | null> | null = null;
const getSample = () => (samplePromise ??= useCapability<SampleFn>("sample"));

class SampleProblem extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** Claude's error codes → the app's own error codes (which have messages in every language). */
function appError(e: unknown): { status: number; error: string } {
  const code = e instanceof SampleProblem ? e.code : ((e as { code?: string } | null)?.code ?? "upstream_error");
  // Shown in the browser's developer console, to help find out why reading failed.
  console.warn("[nuskha] Claude call failed:", code, (e as { message?: string } | null)?.message ?? "");
  const map: Record<string, string> = {
    not_granted: "not_allowed",
    sampling_disabled: "signed_out", not_declared: "signed_out", capability_disabled: "signed_out", capability_removed: "signed_out", session_expired: "signed_out", unavailable: "signed_out",
    images_unavailable: "no_images", image_rejected: "bad_request",
    rate_limited: "rate_limited", prompt_too_large: "too_large",
    refused: "invalid_output", empty_completion: "invalid_output", invalid_json: "invalid_output",
  };
  const error = map[code] ?? "ai_failed";
  return { status: error === "rate_limited" ? 429 : 500, error };
}

/** Ask for JSON matching `schema`; if the answer is unusable, ask once more explaining what was wrong. */
async function askJson<T>(prompt: string, schema: ZodType<T>, images?: Blob[]): Promise<T> {
  const sample = await getSample();
  if (!sample) throw new SampleProblem("unavailable");
  const opts = { cache: false, ...(images?.length ? { images } : {}) };
  let { text, truncated } = await sample(prompt, opts);
  let result = truncated ? ({ ok: false, problems: "- The reply was cut off. Keep it shorter." } as const) : validateJson(text, schema);
  if (!result.ok) {
    const turns: Turn[] = [
      { role: "user", content: prompt },
      { role: "assistant", content: text },
      { role: "user", content: fillPrompt(PROMPTS["json-retry.md"], { ERRORS: result.problems }) },
    ];
    ({ text, truncated } = await sample(turns, opts));
    result = truncated ? ({ ok: false, problems: "cut off" } as const) : validateJson(text, schema);
  }
  if (!result.ok) throw new SampleProblem("invalid_json");
  return result.value;
}

const both = (system: string, user: string) => `${system}\n\n---\n\n${user}`;

function toBlob(b64: string, type: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** If Claude takes fewer pictures per question than there are pages, put pages together top-to-bottom. */
async function fitPages(pages: Blob[], max: number): Promise<Blob[]> {
  if (pages.length <= max) return pages;
  const groups: Blob[][] = Array.from({ length: max }, () => []);
  pages.forEach((p, i) => groups[Math.floor((i * max) / pages.length)].push(p));
  return Promise.all(groups.map(async (group) => {
    const bitmaps = await Promise.all(group.map((b) => createImageBitmap(b)));
    const width = Math.max(...bitmaps.map((b) => b.width));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = bitmaps.reduce((h, b) => h + b.height, 0);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    let y = 0;
    for (const b of bitmaps) {
      ctx.drawImage(b, 0, y);
      y += b.height;
    }
    return new Promise<Blob>((res, rej) => canvas.toBlob((blob) => (blob ? res(blob) : rej(new Error("toBlob"))), "image/jpeg", 0.85));
  }));
}

async function extract(body: ExtractRequest): Promise<Answer<ExtractResponse>> {
  try {
    const sample = await getSample();
    if (!sample) throw new SampleProblem("unavailable");
    // How many pictures one question may carry. Some Claude apps don't say: then the pages are
    // joined into one picture. Whether photos work at all is decided by the call itself
    // (it rejects "images_unavailable"), never guessed in advance.
    const limits = await sample.limits().catch(() => null);
    const maxCount = Math.max(1, limits?.images?.maxCount ?? 1);
    const images = await fitPages(body.images.map((i) => toBlob(i.base64, i.mediaType)), maxCount);
    const vars = extractVars(new Date().toISOString().slice(0, 10), body.images.length);
    const prompt = both(fillPrompt(PROMPTS["extract-system.md"], vars), fillPrompt(PROMPTS["extract-user.md"], vars));
    const result = await askJson(prompt, ExtractionResult, images);
    if (!result.is_prescription) return { status: 200, data: { ok: true, result, checks: [] } };
    const { prescription, checks } = crossCheck(result);
    return { status: 200, data: { ok: true, result: prescription, checks } };
  } catch (e) {
    const { status, error } = appError(e);
    return { status, data: { ok: false, error: error as never } };
  }
}

async function interactions(body: InteractionRequest): Promise<Answer<InteractionResponse>> {
  try {
    const prompt = both(PROMPTS["interactions-system.md"], fillPrompt(PROMPTS["interactions-user.md"], interactionVars(body)));
    return { status: 200, data: { ok: true, ai: await askJson(prompt, AiInteractions) } };
  } catch (e) {
    const { status, error } = appError(e);
    return { status, data: { ok: false, error } };
  }
}

async function translate(body: TranslateRequest): Promise<Answer<TranslateResponse>> {
  try {
    const vars = translateVars(body);
    const prompt = both(fillPrompt(PROMPTS["translate-system.md"], vars.system), fillPrompt(PROMPTS["translate-user.md"], vars.user));
    const { translations } = await askJson(prompt, translationsFor(body.texts.length));
    return { status: 200, data: { ok: true, translations } };
  } catch (e) {
    const { status, error } = appError(e);
    return { status, data: { ok: false, error } };
  }
}

export const aiTransport = { extract, interactions, translate };
export type { Answer };
