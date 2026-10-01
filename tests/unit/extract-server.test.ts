import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sample from "@/tests/fixtures/extraction-handwritten.json";
import { extractPrescription, InvalidOutputError } from "@/lib/server/extract";
import { AIError } from "@/lib/server/anthropic";

const req = { images: [{ mediaType: "image/jpeg" as const, base64: "A".repeat(200) }] };
const reply = (text: string) => new Response(JSON.stringify({ content: [{ type: "text", text }], stop_reason: "end_turn" }), { status: 200 });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  delete process.env.AI_MOCK;
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const bodyOf = (call: number) => JSON.parse(fetchMock.mock.calls[call][1].body);

describe("extractPrescription", () => {
  it("sends images + filled-in prompt and returns checked result", async () => {
    fetchMock.mockResolvedValueOnce(reply("```json\n" + JSON.stringify(sample) + "\n```"));
    const { result, checks } = await extractPrescription(req);
    expect(result.is_prescription).toBe(true);
    const body = bodyOf(0);
    expect(body.system).not.toMatch(/\{\{\w+\}\}/); // every placeholder filled
    expect(body.system).toContain("Augmentin = Amoxicillin + Clavulanic acid");
    expect(body.messages[0].content[0].type).toBe("image");
    expect(fetchMock.mock.calls[0][1].headers["x-api-key"]).toBe("test-key");
    // The sample's Risek has no duration_days but "1/52" → filled to 7 by our own check.
    if (result.is_prescription) expect(result.medicines[2].duration_days).toBe(7);
    expect(Array.isArray(checks)).toBe(true);
  });

  it("retries once when the first answer is broken", async () => {
    fetchMock.mockResolvedValueOnce(reply("Sorry, here is the data: {not json")).mockResolvedValueOnce(reply(JSON.stringify(sample)));
    const { result } = await extractPrescription(req);
    expect(result.is_prescription).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retry = bodyOf(1).messages;
    expect(retry).toHaveLength(3);
    expect(retry[2].content).toContain("not valid JSON");
  });

  it("explains schema problems in the retry", async () => {
    const bad = { ...sample, medicines: "none" };
    fetchMock.mockResolvedValueOnce(reply(JSON.stringify(bad))).mockResolvedValueOnce(reply(JSON.stringify(sample)));
    await extractPrescription(req);
    expect(bodyOf(1).messages[2].content).toContain("medicines");
  });

  it("gives up after the retry also fails", async () => {
    fetchMock.mockImplementation(async () => reply("still not json"));
    await expect(extractPrescription(req)).rejects.toBeInstanceOf(InvalidOutputError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("handles 'not a prescription'", async () => {
    fetchMock.mockResolvedValueOnce(reply('{"is_prescription": false, "reason": "a photo of a cat"}'));
    const { result, checks } = await extractPrescription(req);
    expect(result.is_prescription).toBe(false);
    expect(checks).toEqual([]);
  });

  it("retries without temperature if the model rejects it", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('{"error":{"message":"temperature is not supported"}}', { status: 400 }))
      .mockResolvedValueOnce(reply(JSON.stringify(sample)));
    await extractPrescription(req);
    expect(bodyOf(0).temperature).toBe(0);
    expect(bodyOf(1).temperature).toBeUndefined();
  });

  it("reports a missing API key clearly", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(extractPrescription(req)).rejects.toMatchObject({ code: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports API failures", async () => {
    fetchMock.mockImplementation(async () => new Response("overloaded", { status: 529 }));
    const err = await extractPrescription(req).catch((e) => e);
    expect(err).toBeInstanceOf(AIError);
    expect(err.code).toBe("ai_failed");
  });

  it("treats a cut-off answer as unusable", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ content: [{ type: "text", text: '{"is_pres' }], stop_reason: "max_tokens" }), { status: 200 }));
    await expect(extractPrescription(req)).rejects.toMatchObject({ code: "truncated" });
  });
});
