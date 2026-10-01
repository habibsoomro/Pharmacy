import "server-only";

/**
 * Simple rate limit: each visitor (by IP address) gets `limit` requests per `windowMs`.
 * NOTE: this memory is per server instance. On Vercel it resets often and isn't shared
 * between instances, so it only stops casual misuse. Stage 9 adds a shared limit (Upstash).
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false, retryAfterSec: Math.ceil((windowMs - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear(); // keep memory small
  return { ok: true, retryAfterSec: 0 };
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
