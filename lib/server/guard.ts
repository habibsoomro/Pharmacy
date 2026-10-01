import "server-only";
import { NextResponse } from "next/server";
import { limitVisitor, withinDailyBudget } from "@/lib/server/rate-limit";

/**
 * Checks every AI route does before any work:
 *  1. the request comes from our own website;
 *  2. the visitor hasn't sent too many requests;
 *  3. the whole site is within its optional daily AI budget;
 *  4. the body is JSON and not bigger than allowed (checked while reading,
 *     so a huge upload is stopped early even without a Content-Length header).
 */
export type GuardOptions = { route: string; limit: number; windowSec: number; maxBytes: number };
export type GuardError = "bad_request" | "rate_limited" | "busy" | "too_large";

type Guarded = { ok: true; body: unknown } | { ok: false; response: NextResponse };

const fail = (error: GuardError, status: number, headers?: Record<string, string>): Guarded => ({
  ok: false,
  response: NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store", ...headers } }),
});

export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) return true; // same-origin requests from older browsers may leave it out
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Read the body as text, stopping as soon as it goes over `maxBytes`. */
export async function readLimited(req: Request, maxBytes: number): Promise<string | null> {
  if (Number(req.headers.get("content-length") ?? 0) > maxBytes) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function guard(req: Request, opts: GuardOptions): Promise<Guarded> {
  if (!sameOrigin(req)) return fail("bad_request", 403);
  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) return fail("bad_request", 415);

  const limit = await limitVisitor(req, opts.route, opts.limit, opts.windowSec);
  if (!limit.ok) return fail("rate_limited", 429, { "Retry-After": String(limit.retryAfterSec) });

  const text = await readLimited(req, opts.maxBytes);
  if (text === null) return fail("too_large", 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail("bad_request", 400);
  }

  // Counted last, so rejected requests don't use up the day's budget.
  if (!(await withinDailyBudget())) return fail("busy", 503);
  return { ok: true, body };
}
