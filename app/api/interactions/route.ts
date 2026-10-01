import { NextResponse } from "next/server";
import { InteractionRequest, type InteractionResponse } from "@/lib/schemas/safety";
import { AIError } from "@/lib/server/anthropic";
import { InvalidOutputError } from "@/lib/server/ask-json";
import { checkInteractions } from "@/lib/server/interactions";
import { guard } from "@/lib/server/guard";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const fail = (error: string, status: number) => NextResponse.json<InteractionResponse>({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  const g = await guard(req, { route: "interactions", limit: 20, windowSec: 10 * 60, maxBytes: 50_000 });
  if (!g.ok) return g.response;
  const parsed = InteractionRequest.safeParse(g.body);
  if (!parsed.success) return fail("bad_request", 400);

  try {
    const ai = await checkInteractions(parsed.data);
    return NextResponse.json<InteractionResponse>({ ok: true, ai }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof InvalidOutputError) return fail("invalid_output", 502);
    if (e instanceof AIError) return fail(e.code === "not_configured" ? "not_configured" : e.code === "timeout" ? "timeout" : "ai_failed", e.code === "not_configured" ? 503 : 502);
    console.error("[interactions] unexpected error:", (e as Error).name);
    return fail("ai_failed", 500);
  }
}
