import type { ExtractErrorCode, ExtractResponse } from "@/lib/schemas/extraction";
import type { PreparedImage } from "@/lib/image/prepare";
import { aiTransport } from "@/lib/client/ai-transport";

/**
 * "offline": no internet. The last three only happen in the version inside Claude:
 * "not_allowed" (the person didn't allow the page to use Claude), "signed_out"
 * (not signed in to Claude), "no_images" (this Claude app can't send photos).
 */
export type ClientErrorCode = ExtractErrorCode | "offline" | "not_allowed" | "signed_out" | "no_images";

/** Send the prepared photos to be read. On the website the server talks to the AI, not the browser. */
export async function requestExtraction(images: PreparedImage[]): Promise<ExtractResponse | { ok: false; error: ClientErrorCode }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { ok: false, error: "offline" };
  try {
    const { status, data } = await aiTransport.extract({ images: images.map((i) => ({ mediaType: i.mediaType, base64: i.base64 })) });
    if (data && typeof data.ok === "boolean") return data;
    return { ok: false, error: status === 429 ? "rate_limited" : status === 413 ? "too_large" : "ai_failed" };
  } catch {
    return { ok: false, error: navigator.onLine ? "ai_failed" : "offline" };
  }
}
