import type { Medicine } from "@/lib/schemas/extraction";
import type { Settings } from "@/lib/settings";
import { addDays, courseFor, daysBetween, todayISO } from "@/lib/summary/dates";
import { SLOTS, buildTimetable, type Slot } from "@/lib/summary/timetable";

/**
 * Medicine reminders for the phone's calendar, as a standard .ics file.
 * One repeating event per medicine per time of day, ending on the course's last day.
 */

/** Medicines to take "until the doctor says" get reminders for this many days. */
export const ONGOING_DAYS = 30;

export type Reminder = {
  medIndex: number;
  name: string;
  amount: string | null;
  food: Medicine["food_timing"];
  slot: Slot;
  time: string; // "08:00"
  firstDay: string; // YYYY-MM-DD
  days: number;
  ongoing: boolean;
};

export type ReminderPlan = {
  reminders: Reminder[];
  /** Medicines that got no reminders, and why. */
  skipped: { medIndex: number; name: string; reason: "done" | "asNeeded" | "noDays" | "noTime" | "single" }[];
};

export function planReminders(meds: Medicine[], start: string, times: Settings["reminderTimes"], today = todayISO()): ReminderPlan {
  const tt = buildTimetable(meds);
  const reminders: Reminder[] = [];
  const skipped: ReminderPlan["skipped"] = [];

  meds.forEach((med, medIndex) => {
    const items = SLOTS.flatMap((slot) => tt.slots[slot].filter((x) => x.medIndex === medIndex).map((x) => ({ slot, x })));
    const name = items[0]?.x.name ?? tt.asNeeded.concat(tt.unscheduled).find((x) => x.medIndex === medIndex)?.name ?? "";
    const course = courseFor(med, start, today);

    let firstDay: string;
    let days: number;
    if (course.kind === "fixed") {
      if (course.status === "done") return skipped.push({ medIndex, name, reason: "done" });
      firstDay = course.status === "upcoming" ? course.start : today;
      days = course.totalDays - daysBetween(course.start, firstDay);
    } else if (course.kind === "ongoing") {
      firstDay = today;
      days = ONGOING_DAYS;
    } else {
      const reason = course.kind === "asNeeded" ? "asNeeded" : course.kind === "single" ? "single" : "noDays";
      return skipped.push({ medIndex, name, reason });
    }
    if (!items.length) return skipped.push({ medIndex, name, reason: "noTime" });

    for (const { slot, x } of items) {
      reminders.push({ medIndex, name: x.name, amount: x.amount, food: x.food, slot, time: times[slot], firstDay, days, ongoing: course.kind === "ongoing" });
    }
  });
  return { reminders, skipped };
}

export type IcsEvent = { uid: string; firstDay: string; time: string; days: number; title: string; description: string };

/** Text in .ics files must escape \ ; , and new lines. */
export function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** .ics lines must be at most 75 bytes; longer ones continue on the next line after a space. Never splits a letter. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = out.length ? 74 : 75; // continuation lines start with a space
    if (bytes + n > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/**
 * Builds the calendar file. Times are "floating" (no time zone), so the phone
 * uses its own local time: 08:00 means 8 in the morning wherever the patient is.
 */
export function buildIcs(events: IcsEvent[], now = new Date()): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nuskha//Medicine reminders//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const e of events) {
    const date = e.firstDay.replace(/-/g, "");
    const time = `${e.time.replace(":", "")}00`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${date}T${time}`,
      "DURATION:PT15M",
      `RRULE:FREQ=DAILY;COUNT=${Math.max(1, e.days)}`,
      `SUMMARY:${icsEscape(e.title)}`,
      `DESCRIPTION:${icsEscape(e.description)}`,
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "TRIGGER:PT0M",
      `DESCRIPTION:${icsEscape(e.title)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** Last day a reminder fires (for showing on screen). */
export const lastReminderDay = (r: Pick<Reminder, "firstDay" | "days">) => addDays(r.firstDay, r.days - 1);
