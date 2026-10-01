import type { ExtractErrorCode, ExtractResponse } from "@/lib/schemas/extraction";
import type { PreparedImage } from "@/lib/image/prepare";

export type ClientErrorCode = ExtractErrorCode | "offline";

/** Send the prepared photos to our server. The server talks to the AI, not the browser. */
export async function requestExtraction(images: PreparedImage[]): Promise<ExtractResponse | { ok: false; error: ClientErrorCode }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { ok: false, error: "offline" };
  try {
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ images: images.map((i) => ({ mediaType: i.mediaType, base64: i.base64 })) }),
    });
    const data = (await res.json().catch(() => null)) as ExtractResponse | null;
    if (data && typeof data.ok === "boolean") return data;
    return { ok: false, error: res.status === 429 ? "rate_limited" : res.status === 413 ? "too_large" : "ai_failed" };
  } catch {
    return { ok: false, error: navigator.onLine ? "ai_failed" : "offline" };
  }
}
