import { describe, expect, it } from "vitest";
import { findVoice, speechChunks } from "@/lib/speech";
import { LANG_INFO } from "@/lib/languages";

const voices = [
  { name: "English UK", lang: "en-GB", localService: true },
  { name: "Urdu online", lang: "ur-PK", localService: false },
  { name: "Urdu phone", lang: "ur_PK", localService: true },
  { name: "Hindi", lang: "hi-IN", localService: true },
];

describe("finding a voice", () => {
  it("prefers the voice that works without internet", () => {
    expect(findVoice(voices, LANG_INFO.ur.voices)?.name).toBe("Urdu phone");
  });
  it("falls back through the list", () => {
    expect(findVoice(voices, LANG_INFO.roman.voices)?.name).toBe("English UK");
  });
  it("returns nothing when the phone has no voice for the language", () => {
    expect(findVoice(voices, LANG_INFO.sd.voices)).toBeNull();
    expect(findVoice(voices, LANG_INFO.pa.voices)).toBeNull(); // Gurmukhi (pa-IN) voices can't read Shahmukhi
    expect(findVoice([{ name: "Punjabi IN", lang: "pa-IN" }], LANG_INFO.pa.voices)).toBeNull();
  });
});

describe("splitting text for reading aloud", () => {
  it("drops emojis and bullets and empty lines", () => {
    expect(speechChunks("💊 1. Panadol 500 mg\n\n• What it's for: fever\n⚠️ ")).toEqual(["1. Panadol 500 mg", "What it's for: fever"]);
  });
  it("splits long lines at sentence ends, including Urdu ۔", () => {
    const long = `${"یہ دوا کھانے کے بعد لیں۔ ".repeat(12)}`;
    const parts = speechChunks(long, 80);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(80);
    expect(parts.join(" ").replace(/\s+/g, " ")).toBe(long.trim().replace(/\s+/g, " "));
  });
});
