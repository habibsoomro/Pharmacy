import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/locales/en.json";
import ur from "@/locales/ur.json";
import elderlyJson from "@/tests/fixtures/extraction-elderly.json";
import { Prescription } from "@/lib/schemas/extraction";
import { TranslateRequest } from "@/lib/schemas/translate";
import { chunkTexts, flattenStrings, translatable, translationOk, withStrings } from "@/lib/translate/core";
import { buildTranslatePrompts, translateTexts } from "@/lib/server/translate";
import { InvalidOutputError } from "@/lib/server/ask-json";
import { localReport } from "@/lib/client/safety";
import { fullText, summaryTexts, type ShareCtx } from "@/lib/summary/share-text";

describe("summary labels", () => {
  const entries = flattenStrings(en);

  it("collects the summary labels with their paths", () => {
    expect(entries).toContainEqual(["summary.med.days", "{n} days"]);
    expect(entries).toContainEqual(["common.disclaimer", en.common.disclaimer]);
    expect(entries.some(([p]) => p.startsWith("home."))).toBe(false); // website labels are not sent
    expect(entries.length).toBeGreaterThan(150);
  });

  it("puts translations back in the right places and keeps the rest", () => {
    const out = withStrings(ur, { "summary.med.days": "{n} ورځې", "summary.title": "ستاسو نسخه", "nope.missing": "x" });
    expect(out.summary.med.days).toBe("{n} ورځې");
    expect(out.summary.title).toBe("ستاسو نسخه");
    expect(out.summary.med.once).toBe(ur.summary.med.once);
    expect(ur.summary.title).not.toBe("ستاسو نسخه"); // original untouched
  });
});

describe("checking AI translations", () => {
  it("rejects translations that lost a placeholder or are empty", () => {
    expect(translationOk("{n} days", "{n} دن")).toBe(true);
    expect(translationOk("{n} days", "دن")).toBe(false);
    expect(translationOk("Day {n} of {total}", "{total} میں سے {n} دن")).toBe(true);
    expect(translationOk("Hello", "   ")).toBe(false);
    expect(translationOk("Hi", "x".repeat(200))).toBe(false);
  });

  it("only sends real words, once each", () => {
    expect(translatable(["Fever", " Fever ", "2026-10-01", "500", null, "", "Take after food"])).toEqual(["Fever", "Take after food"]);
  });

  it("splits big batches", () => {
    const texts = Array.from({ length: 95 }, (_, i) => `text ${i}`);
    const chunks = chunkTexts(texts, 40, 100000);
    expect(chunks.map((c) => c.length)).toEqual([40, 40, 15]);
    expect(chunkTexts(["a".repeat(30), "b".repeat(30), "c"], 40, 50).map((c) => c.length)).toEqual([1, 2]);
  });
});

describe("texts from the prescription", () => {
  const rx = Prescription.parse(elderlyJson);
  const safety = localReport(rx);
  const base: ShareCtx = {
    t: en, lang: "en", rx, safety, start: "2026-10-01", notes: ["Take with plenty of water"], generalNote: "Come back on Monday",
    tx: (s) => s, detailed: false, pharmacist: false,
  };

  it("includes what needs translating but never names or phone numbers", () => {
    const texts = translatable(summaryTexts(base));
    expect(texts).toContain("Take with plenty of water");
    expect(texts).toContain(safety.alerts[0].whatHappens);
    expect(texts).not.toContain(rx.patient.name.value);
    expect(texts).not.toContain(rx.doctor.phone.value);
  });

  it("uses translations in shared text and leaves out hidden cards (never safety)", () => {
    const tx = ((s: string | null) => (s === "Come back on Monday" ? "پیر کو دوبارہ آئیں" : s)) as ShareCtx["tx"];
    const text = fullText({ ...base, tx }, "Nuskha", (c) => c !== "doctor");
    expect(text).toContain("پیر کو دوبارہ آئیں");
    expect(text).not.toContain(rx.doctor.name.value!);
    expect(text).toContain(en.summary.cards.safety);
  });
});

describe("translate service", () => {
  const req = TranslateRequest.parse({ target: "ps", level: "simple", texts: ["Take after food", "{n} days"] });
  const reply = (text: string) => new Response(JSON.stringify({ content: [{ type: "text", text }], stop_reason: "end_turn" }), { status: 200 });
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "k";
    delete process.env.AI_MOCK;
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("builds prompts for the right language with no empty placeholders", () => {
    const { system, user } = buildTranslatePrompts(req);
    expect(system).toContain("Pashto");
    expect(system).toContain("simplest everyday words");
    expect(system).toContain("NEVER tell the reader to stop");
    expect(system).not.toMatch(/\{\{\w+\}\}/);
    expect(user).toContain('"text": "{n} days"');
    expect(buildTranslatePrompts({ ...req, target: "roman" }).system).toContain("English (Latin) letters");
  });

  it("returns one translation per text", async () => {
    fetchMock.mockResolvedValueOnce(reply(JSON.stringify({ translations: ["له ډوډۍ وروسته واخلئ", "{n} ورځې"] })));
    expect(await translateTexts(req)).toEqual(["له ډوډۍ وروسته واخلئ", "{n} ورځې"]);
  });

  it("asks again if the number of translations is wrong, then gives up", async () => {
    fetchMock.mockImplementation(async () => reply(JSON.stringify({ translations: ["only one"] })));
    await expect(translateTexts(req)).rejects.toBeInstanceOf(InvalidOutputError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("remembers website labels, but never prescription texts", async () => {
    const ui = { ...req, level: "ui" as const, texts: ["Daily timetable"] };
    fetchMock.mockImplementation(async () => reply(JSON.stringify({ translations: ["ورځنی مهال ویش"] })));
    await translateTexts(ui);
    await translateTexts(ui);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const rx = { ...req, texts: ["Daily timetable"] };
    await translateTexts(rx);
    await translateTexts(rx);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("refuses English as a target and too many texts", () => {
    expect(TranslateRequest.safeParse({ ...req, target: "en" }).success).toBe(false);
    expect(TranslateRequest.safeParse({ ...req, texts: Array(81).fill("x") }).success).toBe(false);
    expect(TranslateRequest.safeParse({ ...req, target: "fr" }).success).toBe(false);
  });

  it("test mode marks texts instead of calling the AI", async () => {
    process.env.AI_MOCK = "1";
    expect(await translateTexts(req)).toEqual(["[ps] Take after food", "[ps] {n} days"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
