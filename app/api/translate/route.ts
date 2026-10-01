import { NextResponse } from "next/server";
import { TranslateRequest, type TranslateResponse } from "@/lib/schemas/translate";
import { AIError } from "@/lib/server/anthropic";
import { InvalidOutputError } from "@/lib/server/ask-json";
import { translateTexts } from "@/lib/server/translate";
import { guard } from "@/lib/server/guard";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const fail = (error: string, status: number) => NextResponse.json<TranslateResponse>({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  // One summary needs 1 to 6 requests; this allows several summaries and language changes.
  const g = await guard(req, { route: "translate", limit: 40, windowSec: 10 * 60, maxBytes: 60_000 });
  if (!g.ok) return g.response;
  const parsed = TranslateRequest.safeParse(g.body);
  if (!parsed.success) return fail("bad_request", 400);

  try {
    // Texts are used only for this request and never written anywhere.
    const translations = await translateTexts(parsed.data);
    return NextResponse.json<TranslateResponse>({ ok: true, translations }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof InvalidOutputError) return fail("invalid_output", 502);
    if (e instanceof AIError) return fail(e.code === "not_configured" ? "not_configured" : e.code === "timeout" ? "timeout" : "ai_failed", e.code === "not_configured" ? 503 : 502);
    console.error("[translate] unexpected error:", (e as Error).name);
    return fail("ai_failed", 500);
  }
}
