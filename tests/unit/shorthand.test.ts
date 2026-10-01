import { describe, expect, it } from "vitest";
import { parseDose, parseDuration, parseFrequency, totalFromSchedule, totalQuantity } from "@/lib/rx/shorthand";

describe("parseFrequency", () => {
  it.each([
    ["1+0+1", 2, { morning: 1, afternoon: 0, evening: 0, night: 1 }],
    ["1-0-1", 2, { morning: 1, afternoon: 0, evening: 0, night: 1 }],
    ["1+1+1", 3, { morning: 1, afternoon: 1, evening: 0, night: 1 }],
    ["0+0+1", 1, { morning: 0, afternoon: 0, evening: 0, night: 1 }],
    ["1+0+0", 1, { morning: 1, afternoon: 0, evening: 0, night: 0 }],
    ["1+1+1+1", 4, { morning: 1, afternoon: 1, evening: 1, night: 1 }],
    ["½+0+½", 2, { morning: 0.5, afternoon: 0, evening: 0, night: 0.5 }],
    ["1 + 0 + 1  x 5 days", 2, { morning: 1, afternoon: 0, evening: 0, night: 1 }],
    ["۱+۰+۱", 2, { morning: 1, afternoon: 0, evening: 0, night: 1 }],
  ])("%s → %i times a day", (text, times, schedule) => {
    const f = parseFrequency(text)!;
    expect(f.timesPerDay).toBe(times);
    expect(f.schedule).toEqual(schedule);
  });

  it("reads units per dose from the pattern", () => {
    expect(parseFrequency("2+0+2")!.unitsPerDoseFromPattern).toBe(2);
    expect(parseFrequency("1+0+2")!.unitsPerDoseFromPattern).toBeNull(); // differs by time
  });

  it.each([
    ["OD", 1], ["BD", 2], ["BID", 2], ["TDS", 3], ["TID", 3], ["QID", 4], ["HS", 1],
    ["twice daily", 2], ["8 hourly", 3], ["Tab once daily", 1], ["دن میں دو بار", 2], ["raat ko", 1],
  ])("%s → %i", (text, times) => {
    expect(parseFrequency(text)!.timesPerDay).toBe(times);
  });

  it("HS means night", () => {
    expect(parseFrequency("HS")!.schedule.night).toBe(1);
  });

  it("SOS / PRN is 'as needed' with no fixed times", () => {
    for (const t of ["SOS", "PRN", "1 tab SOS", "as needed"]) {
      const f = parseFrequency(t)!;
      expect(f.asNeeded).toBe(true);
      expect(f.timesPerDay).toBeNull();
    }
  });

  it("STAT is a single dose", () => {
    expect(parseFrequency("STAT")!.singleDose).toBe(true);
  });

  it("does not treat a date as a dose pattern", () => {
    expect(parseFrequency("12-05-2026")).toBeNull();
  });

  it("returns null for text it doesn't understand", () => {
    expect(parseFrequency("as directed by doctor")).toBeNull();
    expect(parseFrequency("")).toBeNull();
    expect(parseFrequency(null)).toBeNull();
  });
});

describe("parseDuration", () => {
  it.each([
    ["x 5 days", 5], ["5/7", 5], ["x 1/52", 7], ["2/52", 14], ["1/12", 30], ["3/12", 90],
    ["2 weeks", 14], ["2 wks", 14], ["1 month", 30], ["10d", 10], ["for a week", 7],
    ["5 دن", 5], ["2 ہفتے", 14], ["۷ دن", 7], ["10 din", 10],
  ])("%s → %i days", (text, days) => {
    expect(parseDuration(text)!.days).toBe(days);
  });

  it("recognises long-term medicines", () => {
    expect(parseDuration("continue")).toEqual({ days: null, ongoing: true });
    expect(parseDuration("long term")).toEqual({ days: null, ongoing: true });
  });

  it("returns null when there is no duration", () => {
    expect(parseDuration("after meal")).toBeNull();
  });
});

describe("parseDose", () => {
  it.each([
    ["1 tablet", 1, "unit"], ["½ tab", 0.5, "unit"], ["1/2 tab", 0.5, "unit"], ["2 caps", 2, "unit"],
    ["5 ml", 5, "ml"], ["1 tsp", 5, "ml"], ["2 TSF", 10, "ml"], ["2 drops", 2, "drop"], ["1 sachet", 1, "sachet"],
  ])("%s → %d %s", (text, amount, unit) => {
    expect(parseDose(text)).toEqual({ amount, unit });
  });
});

describe("totalQuantity", () => {
  it("1 tab twice a day for 5 days = 10 tablets", () => {
    expect(totalQuantity({ amount: 1, unit: "unit" }, 2, 5)).toEqual({ amount: 10, unit: "unit" });
  });
  it("half tablet rounds up to whole tablets", () => {
    expect(totalQuantity({ amount: 0.5, unit: "unit" }, 3, 5)).toEqual({ amount: 8, unit: "unit" });
  });
  it("syrup: 5 ml three times a day for 5 days = 75 ml", () => {
    expect(totalQuantity({ amount: 5, unit: "ml" }, 3, 5)).toEqual({ amount: 75, unit: "ml" });
  });
  it("never guesses when something is missing", () => {
    expect(totalQuantity({ amount: 1, unit: "unit" }, null, 5)).toBeNull();
    expect(totalQuantity({ amount: 1, unit: "unit" }, 2, null)).toBeNull();
    expect(totalQuantity(null, 2, 5)).toBeNull();
  });
  it("uneven schedule 1+0+2 for 7 days = 21", () => {
    expect(totalFromSchedule({ morning: 1, afternoon: 0, evening: 0, night: 2 }, 7)).toBe(21);
  });
});
