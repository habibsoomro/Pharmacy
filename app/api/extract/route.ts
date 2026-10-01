import { NextResponse } from "next/server";
import { ExtractRequest, type ExtractErrorCode, type ExtractResponse } from "@/lib/schemas/extraction";
import { AIError, extractPrescription, InvalidOutputError } from "@/lib/server/extract";
import { guard } from "@/lib/server/guard";

export const runtime = "nodejs";
export const maxDuration = 60; // seconds (Vercel)
export const dynamic = "force-dynamic";

function fail(error: ExtractErrorCode, status: number) {
  return NextResponse.json<ExtractResponse>({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  // Own website only; 8 scans per visitor per 10 minutes; Vercel's body limit is 4.5 MB
  // and 4 compressed pages are usually under 1 MB.
  const g = await guard(req, { route: "extract", limit: 8, windowSec: 10 * 60, maxBytes: 4_000_000 });
  if (!g.ok) return g.response;
  const parsed = ExtractRequest.safeParse(g.body);
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
