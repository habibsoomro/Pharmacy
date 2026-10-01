import { NextResponse } from "next/server";
import { InteractionRequest, type InteractionResponse } from "@/lib/schemas/safety";
import { AIError } from "@/lib/server/anthropic";
import { InvalidOutputError } from "@/lib/server/ask-json";
import { checkInteractions } from "@/lib/server/interactions";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const fail = (error: string, status: number) => NextResponse.json<InteractionResponse>({ ok: false, error }, { status });

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return fail("bad_request", 403);

  if (!rateLimit(`interactions:${clientIp(req)}`, 20, 10 * 60 * 1000).ok) return fail("rate_limited", 429);
  if (Number(req.headers.get("content-length") ?? 0) > 50_000) return fail("bad_request", 413);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("bad_request", 400);
  }
  const parsed = InteractionRequest.safeParse(body);
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
