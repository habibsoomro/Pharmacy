import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, EARLY_SETTINGS_SCRIPT, parseSettings } from "@/lib/settings";

describe("settings", () => {
  it("has safe defaults", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ summaryLang: null, level: "simple", textSize: "normal", theme: "auto", view: "patient", pictures: true, hiddenCards: [] });
    expect(DEFAULT_SETTINGS.reminderTimes.morning).toBe("08:00");
  });
  it("keeps good values and replaces only the broken ones", () => {
    const s = parseSettings(JSON.stringify({ summaryLang: "ps", textSize: "huge", theme: "dark", hiddenCards: ["doctor"], reminderTimes: { morning: "25:00" } }));
    expect(s.summaryLang).toBe("ps");
    expect(s.theme).toBe("dark");
    expect(s.hiddenCards).toEqual(["doctor"]);
    expect(s.textSize).toBe("normal");
    expect(s.reminderTimes).toEqual(DEFAULT_SETTINGS.reminderTimes);
  });
  it("never lets the safety card be hidden or a site language be stored as summary-only", () => {
    expect(parseSettings(JSON.stringify({ hiddenCards: ["safety"] })).hiddenCards).toEqual([]);
    expect(parseSettings(JSON.stringify({ summaryLang: "ur" })).summaryLang).toBeNull();
  });
  it("survives damaged storage", () => {
    expect(parseSettings("{not json")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("null")).toEqual(DEFAULT_SETTINGS);
  });
  it("keeps the old pharmacist-mode choice from the review screen", () => {
    expect(parseSettings(null, "on").view).toBe("pharmacist");
    expect(parseSettings(JSON.stringify({ view: "patient" }), "on").view).toBe("patient");
  });
  it("early script is valid JavaScript", () => {
    expect(() => new Function(EARLY_SETTINGS_SCRIPT)).not.toThrow();
  });
});
