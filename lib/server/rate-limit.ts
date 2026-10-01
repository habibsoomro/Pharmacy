import "server-only";
import { createHash } from "node:crypto";

/**
 * Rate limits for the API routes.
 *
 * With UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN set (free tier at upstash.com),
 * the counts are shared by every server instance, so limits really hold on Vercel.
 * Without them, each server instance counts on its own (fine on your computer,
 * weaker online). If Upstash can't be reached, the instance's own count is used.
 *
 * Visitors are counted by a scrambled (hashed) form of their internet address,
 * so real IP addresses are never stored.
 */

export type LimitResult = { ok: boolean; retryAfterSec: number };

const memory = new Map<string, { count: number; resetAt: number }>();

function memoryHit(key: string, limit: number, windowSec: number, now: number): LimitResult {
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    if (memory.size > 5000) memory.clear(); // keep memory small
    memory.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { ok: true, retryAfterSec: 0 };
  }
  entry.count++;
  return entry.count > limit ? { ok: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) } : { ok: true, retryAfterSec: 0 };
}

/** Count one hit in Upstash (fixed window). Returns the count, or null if Upstash isn't set up or didn't answer. */
async function upstashHit(key: string, windowSec: number): Promise<number | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      signal: controller.signal,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify([["INCR", key], ["EXPIRE", key, String(windowSec), "NX"]]),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = (await res.json()) as { result?: unknown; error?: string }[];
    const count = Number(data?.[0]?.result);
    return Number.isFinite(count) ? count : null;
  } catch (e) {
    console.error("[rate-limit] Upstash unavailable, using this server's own count:", (e as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** One hit against `limit` per `windowSec` for this key. */
export async function hit(key: string, limit: number, windowSec: number, now = Date.now()): Promise<LimitResult> {
  const bucket = Math.floor(now / (windowSec * 1000));
  const shared = await upstashHit(`nuskha:rl:${key}:${bucket}`, windowSec);
  if (shared === null) return memoryHit(key, limit, windowSec, now);
  const resetAt = (bucket + 1) * windowSec * 1000;
  return shared > limit ? { ok: false, retryAfterSec: Math.ceil((resetAt - now) / 1000) } : { ok: true, retryAfterSec: 0 };
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** A scrambled form of the visitor's address: same visitor → same value, but the address can't be read back. */
export function visitorId(req: Request): string {
  const salt = process.env.RATE_LIMIT_SALT ?? "nuskha";
  return createHash("sha256").update(`${salt}:${clientIp(req)}`).digest("base64url").slice(0, 22);
}

/** Per-visitor limit for one API route. */
export function limitVisitor(req: Request, route: string, limit: number, windowSec: number): Promise<LimitResult> {
  return hit(`${route}:${visitorId(req)}`, limit, windowSec);
}

/**
 * Optional total budget for the whole website per day (AI_DAILY_LIMIT in the
 * environment, e.g. 500). Protects your Anthropic bill if someone misuses the site.
 * Not set = no daily limit.
 */
export async function withinDailyBudget(now = Date.now()): Promise<boolean> {
  const max = Number(process.env.AI_DAILY_LIMIT);
  if (!Number.isFinite(max) || max <= 0) return true;
  return (await hit("ai-day", max, 24 * 60 * 60, now)).ok;
}

/** Only for tests. */
export function resetRateLimits() {
  memory.clear();
}
