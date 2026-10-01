import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { guard, readLimited, sameOrigin } from "@/lib/server/guard";
import { hit, resetRateLimits, visitorId, withinDailyBudget } from "@/lib/server/rate-limit";

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("https://nuskha.example/api/x", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", host: "nuskha.example", origin: "https://nuskha.example", "x-forwarded-for": "1.2.3.4", ...headers },
  });
const opts = { route: "t", limit: 2, windowSec: 600, maxBytes: 100 };

beforeEach(() => {
  resetRateLimits();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.AI_DAILY_LIMIT;
});
afterEach(() => vi.unstubAllGlobals());

describe("request checks", () => {
  it("accepts a normal request and returns the JSON", async () => {
    const g = await guard(post('{"a":1}'), opts);
    expect(g.ok && g.body).toEqual({ a: 1 });
  });

  it("refuses other websites, wrong content type and broken JSON", async () => {
    expect(sameOrigin(post("{}", { origin: "https://evil.example" }))).toBe(false);
    const other = await guard(post("{}", { origin: "https://evil.example" }), opts);
    expect(!other.ok && other.response.status).toBe(403);
    const text = await guard(post("{}", { "content-type": "text/plain" }), opts);
    expect(!text.ok && text.response.status).toBe(415);
    const broken = await guard(post("{nope"), opts);
    expect(!broken.ok && broken.response.status).toBe(400);
  });

  it("stops oversized bodies even without a Content-Length header", async () => {
    const big = "x".repeat(500);
    const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(big)); c.close(); } });
    const req = new Request("https://nuskha.example/api/x", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    expect(await readLimited(req, 100)).toBeNull();
    const g = await guard(post(JSON.stringify({ t: big })), opts);
    expect(!g.ok && g.response.status).toBe(413);
  });

  it("limits each visitor separately", async () => {
    expect((await guard(post("{}"), opts)).ok).toBe(true);
    expect((await guard(post("{}"), opts)).ok).toBe(true);
    const third = await guard(post("{}"), opts);
    expect(!third.ok && third.response.status).toBe(429);
    expect(!third.ok && Number(third.response.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await guard(post("{}", { "x-forwarded-for": "5.6.7.8" }), opts)).ok).toBe(true);
  });

  it("never keeps the real internet address", () => {
    const id = visitorId(post("{}"));
    expect(id).not.toContain("1.2.3.4");
    expect(id).toBe(visitorId(post("{}")));
  });
});

describe("shared limits (Upstash)", () => {
  it("uses Upstash when set up, without the raw address", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://up.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ result: 3 }, { result: 1 }])));
    vi.stubGlobal("fetch", fetchMock);
    const r = await hit("t:visitor", 2, 600, 1_000_000);
    expect(r.ok).toBe(false);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://up.example/pipeline");
    expect(String(init.body)).toContain("INCR");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok");
  });

  it("falls back to this server's own count if Upstash is down", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://up.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await hit("k", 1, 600)).ok).toBe(true);
    expect((await hit("k", 1, 600)).ok).toBe(false);
  });
});

describe("daily budget", () => {
  it("is off unless AI_DAILY_LIMIT is set", async () => {
    for (let i = 0; i < 5; i++) expect(await withinDailyBudget()).toBe(true);
  });
  it("says 'busy' once the day's budget is used", async () => {
    process.env.AI_DAILY_LIMIT = "2";
    expect((await guard(post("{}"), { ...opts, limit: 10 })).ok).toBe(true);
    expect((await guard(post("{}", { "x-forwarded-for": "9.9.9.9" }), { ...opts, limit: 10 })).ok).toBe(true);
    const third = await guard(post("{}", { "x-forwarded-for": "8.8.8.8" }), { ...opts, limit: 10 });
    expect(!third.ok && third.response.status).toBe(503);
    expect(!third.ok && (await third.response.json()).error).toBe("busy");
  });
});
