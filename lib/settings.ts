import { z } from "zod";
import { EXTRA_LANGS } from "@/lib/languages";

/**
 * Everything the person can change in the Settings panel.
 * Saved only on this phone (localStorage). A damaged or old saved value
 * falls back to the default for that one setting, never breaking the page.
 */

/** Cards that can be turned off. The Safety Alerts card can't: it is always shown. */
export const HIDEABLE_CARDS = ["patient", "doctor", "diagnosis", "medicines", "timetable", "calendar", "interactions", "care", "dispensing"] as const;
export type HideableCard = (typeof HIDEABLE_CARDS)[number];

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const Settings = z.object({
  /** null = summary in the website's language; otherwise one of the AI-translated languages. */
  summaryLang: z.enum(EXTRA_LANGS).nullable().catch(null),
  level: z.enum(["simple", "detailed"]).catch("simple"),
  textSize: z.enum(["normal", "large", "xl"]).catch("normal"),
  theme: z.enum(["auto", "light", "dark"]).catch("auto"),
  view: z.enum(["patient", "pharmacist"]).catch("patient"),
  pictures: z.boolean().catch(true),
  hiddenCards: z.array(z.enum(HIDEABLE_CARDS)).catch([]),
  speechRate: z.enum(["slow", "normal"]).catch("normal"),
  /** Save every summary in My prescriptions without asking (off by default: phones are often shared). */
  autoSave: z.boolean().catch(false),
  reminderTimes: z
    .object({ morning: time, afternoon: time, evening: time, night: time })
    .catch({ morning: "08:00", afternoon: "14:00", evening: "19:00", night: "22:00" }),
});
export type Settings = z.infer<typeof Settings>;

export const DEFAULT_SETTINGS: Settings = Settings.parse({});

export const SETTINGS_KEY = "nuskha:settings";
/** Older key from Stage 4's review screen; read once so nobody loses their choice. */
const OLD_PHARMACIST_KEY = "nuskha:pharmacist-mode";

export function parseSettings(raw: string | null, oldPharmacist?: string | null): Settings {
  let data: unknown = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = {};
    }
  } else if (oldPharmacist === "on") {
    data = { view: "pharmacist" };
  }
  return Settings.parse(data && typeof data === "object" ? data : {});
}

export function loadSettings(): Settings {
  try {
    return parseSettings(localStorage.getItem(SETTINGS_KEY), localStorage.getItem(OLD_PHARMACIST_KEY));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* private mode / storage full: settings just won't be remembered */
  }
}

export const TEXT_SCALE: Record<Settings["textSize"], number> = { normal: 1, large: 1.15, xl: 1.3 };

/**
 * Runs in <head> before the page is drawn, so the chosen theme and text size
 * are there from the first moment (no white flash in dark mode).
 * Keep this small and self-contained: it is inlined as a string.
 */
export const EARLY_SETTINGS_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_KEY)})||"{}");var d=document.documentElement;var t=s.theme;if(t!=="light"&&t!=="dark"){t=window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}d.dataset.theme=t;var z={normal:1,large:1.15,xl:1.3}[s.textSize]||1;d.style.setProperty("--text-scale",String(z))}catch(e){}})();`;
