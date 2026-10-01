import type { ExtractRequest, ExtractResponse } from "@/lib/schemas/extraction";
import type { InteractionRequest, InteractionResponse } from "@/lib/schemas/safety";
import type { TranslateRequest, TranslateResponse } from "@/lib/schemas/translate";

/**
 * How the phone reaches the AI. On the normal website: our own server's API
 * routes (which hold the API key). The single-page version inside Claude swaps
 * this one file for artifact/ai-transport.ts, which asks Claude through the page.
 * Each call resolves with the HTTP-style status and the route's JSON answer (or
 * null if there was none); it rejects only when there is no connection at all.
 */
export type Answer<T> = { status: number; data: T | null };

async function post<T>(path: string, body: unknown): Promise<Answer<T>> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, data: (await res.json().catch(() => null)) as T | null };
}

export const aiTransport = {
  extract: (body: ExtractRequest) => post<ExtractResponse>("/api/extract", body),
  /** Reading typed text instead of photos: only the version inside Claude offers it (when photos can't be sent). */
  extractText: async (_text: string): Promise<Answer<ExtractResponse>> => ({ status: 400, data: { ok: false, error: "bad_request" } }),
  interactions: (body: InteractionRequest) => post<InteractionResponse>("/api/interactions", body),
  translate: (body: TranslateRequest) => post<TranslateResponse>("/api/translate", body),
};
