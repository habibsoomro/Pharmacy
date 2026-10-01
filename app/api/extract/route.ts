import { NextResponse } from "next/server";
import { ExtractRequest, type ExtractErrorCode, type ExtractResponse } from "@/lib/schemas/extraction";
import { AIError, extractPrescription, InvalidOutputError } from "@/lib/server/extract";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60; // seconds (Vercel)
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4_000_000; // Vercel's limit is 4.5 MB; 4 compressed pages are usually < 1 MB

function fail(error: ExtractErrorCode, status: number, headers?: Record<string, string>) {
  return NextResponse.json<ExtractResponse>({ ok: false, error }, { status, headers });
}

export async function POST(req: Request) {
  // Only accept requests from our own website.
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return fail("bad_request", 403);

  const limit = rateLimit(`extract:${clientIp(req)}`, 8, 10 * 60 * 1000); // 8 scans per 10 minutes
  if (!limit.ok) return fail("rate_limited", 429, { "Retry-After": String(limit.retryAfterSec) });

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return fail("bad_request", 413);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("bad_request", 400);
  }
  const parsed = ExtractRequest.safeParse(body);
  if (!parsed.success) return fail("bad_request", 400);

  try {
    // Images are used only for this request and never written anywhere.
    const { result, checks } = await extractPrescription(parsed.data);
    return NextResponse.json<ExtractResponse>({ ok: true, result, checks }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof InvalidOutputError) return fail("invalid_output", 502);
    if (e instanceof AIError) {
      if (e.code === "not_configured") return fail("not_configured", 503);
      if (e.code === "timeout") return fail("timeout", 504);
      if (e.code === "truncated") return fail("invalid_output", 502);
      return fail("ai_failed", 502);
    }
    console.error("[extract] unexpected error:", (e as Error).name);
    return fail("ai_failed", 500);
  }
}
