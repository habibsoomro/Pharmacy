import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ai from "@/tests/fixtures/interactions-elderly.json";
import { checkInteractions, buildInteractionPrompt } from "@/lib/server/interactions";
import { InteractionRequest } from "@/lib/schemas/safety";
import { InvalidOutputError } from "@/lib/server/ask-json";

const req = InteractionRequest.parse({
  medicines: [
    { name: "Coumadin", generic: "Warfarin", strength: "5 mg", dose: "1 tablet", frequency: "0+0+1", times_per_day: 1, duration_days: null, route: "oral", form: "tablet" },
    { name: "Brufen", generic: "Ibuprofen", strength: "400 mg", dose: "1 tablet", frequency: "TDS", times_per_day: 3, duration_days: 5, route: "oral", form: "tablet" },
  ],
  patient: { age: "72 years", sex: "Male", weight: null },
  diagnosis: "Knee pain",
  allergies: null,
});
const reply = (text: string) => new Response(JSON.stringify({ content: [{ type: "text", text }], stop_reason: "end_turn" }), { status: 200 });
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "k";
  delete process.env.AI_MOCK;
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("interactions service", () => {
  it("builds a complete prompt with no empty placeholders", () => {
    const p = buildInteractionPrompt(req);
    expect(p).not.toMatch(/\{\{\w+\}\}/);
    expect(p).toContain("1. Coumadin (generic: Warfarin)");
    expect(p).toContain("weight not written");
  });
  it("returns the checked AI answer", async () => {
    fetchMock.mockResolvedValueOnce(reply(JSON.stringify(ai)));
    const r = await checkInteractions(req);
    expect(r.interactions[0].severity).toBe("major");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.system).toContain("NEVER tell the patient to stop");
  });
  it("retries once, then gives up", async () => {
    fetchMock.mockImplementation(async () => reply("nope"));
    await expect(checkInteractions(req)).rejects.toBeInstanceOf(InvalidOutputError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("rejects requests carrying more than allowed", () => {
    expect(InteractionRequest.safeParse({ ...req, medicines: [] }).success).toBe(false);
  });
});
