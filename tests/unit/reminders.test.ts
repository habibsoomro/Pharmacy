import { describe, expect, it } from "vitest";
import sample from "@/tests/fixtures/extraction-handwritten.json";
import { Prescription } from "@/lib/schemas/extraction";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { ONGOING_DAYS, buildIcs, foldLine, icsEscape, lastReminderDay, planReminders } from "@/lib/summary/reminders";

const rx = Prescription.parse(sample);
const times = DEFAULT_SETTINGS.reminderTimes;

describe("reminder plan", () => {
  // Course started 28 Sep, today is 1 Oct (day 4).
  const plan = planReminders(rx.medicines, "2026-09-28", times, "2026-10-01");

  it("reminds only for the days that are left", () => {
    const aug = plan.reminders.filter((r) => r.name === "Augmentin");
    expect(aug.map((r) => r.slot)).toEqual(["morning", "night"]); // 1+0+1
    expect(aug[0]).toMatchObject({ firstDay: "2026-10-01", days: 2, time: "08:00", amount: "1 tablet" }); // 5-day course, 2 days left
    expect(lastReminderDay(aug[0])).toBe("2026-10-02");
    const risek = plan.reminders.find((r) => r.name === "Risek");
    expect(risek).toMatchObject({ slot: "morning", days: 4 }); // x 1/52 = 7 days
  });

  it("explains which medicines get no reminders", () => {
    expect(plan.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Panadol", reason: "asNeeded" }),
        expect.objectContaining({ name: "Klorofin?", reason: "noDays" }),
      ]),
    );
  });

  it("skips finished courses and starts future ones on their first day", () => {
    const done = planReminders([rx.medicines[0]], "2026-09-01", times, "2026-10-01");
    expect(done.reminders).toHaveLength(0);
    expect(done.skipped[0].reason).toBe("done");
    const later = planReminders([rx.medicines[0]], "2026-10-05", times, "2026-10-01");
    expect(later.reminders[0]).toMatchObject({ firstDay: "2026-10-05", days: 5 });
  });

  it("gives medicines to keep taking a limited number of days", () => {
    const ongoing = planReminders([{ ...rx.medicines[0], duration_days: null, duration_text: "continue" }], "2026-09-28", times, "2026-10-01");
    expect(ongoing.reminders[0]).toMatchObject({ ongoing: true, days: ONGOING_DAYS, firstDay: "2026-10-01" });
  });

  it("uses the person's chosen times", () => {
    const p = planReminders([rx.medicines[0]], "2026-10-01", { ...times, night: "21:30" }, "2026-10-01");
    expect(p.reminders.find((r) => r.slot === "night")?.time).toBe("21:30");
  });
});

describe("calendar file", () => {
  const ics = buildIcs(
    [{ uid: "a@nuskha", firstDay: "2026-10-01", time: "08:00", days: 5, title: "💊 Augmentin لیں (1 tablet)", description: "Food: after meal, swallow\nAI can make mistakes; check." }],
    new Date("2026-10-01T03:04:05Z"),
  );
  const lines = ics.split("\r\n");

  it("is a valid repeating event with an alarm", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART:20261001T080000");
    expect(ics).toContain("RRULE:FREQ=DAILY;COUNT=5");
    expect(ics).toContain("DTSTAMP:20261001T030405Z");
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("escapes commas, semicolons and new lines", () => {
    expect(icsEscape("a,b;c\nd\\e")).toBe(String.raw`a\,b\;c\nd\\e`);
    expect(ics).toContain(String.raw`DESCRIPTION:Food: after meal\, swallow\nAI can make mistakes\; check.`);
  });

  it("keeps every line within 75 bytes without breaking Urdu letters", () => {
    const enc = new TextEncoder();
    for (const l of lines) expect(enc.encode(l).length).toBeLessThanOrEqual(75);
    const long = `SUMMARY:${"دوا ".repeat(40)}`;
    const folded = foldLine(long);
    expect(folded.split("\r\n ").join("")).toBe(long);
    expect(folded).not.toContain("�");
  });
});
