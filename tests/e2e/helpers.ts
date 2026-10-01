import { expect, type BrowserContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

export const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "fixtures", `${name}.json`), "utf8"));

/** Show the website in Urdu ("ur"), Sindhi ("sd") or English ("en"). */
export async function useLanguage(context: BrowserContext, baseURL: string, lang: "en" | "ur" | "sd") {
  await context.addCookies([{ name: "nuskha_lang", value: lang, url: baseURL }]);
}

/** Put a sample prescription into the browser tab, as if it had just been scanned and checked. */
export async function withScan(context: BrowserContext, sample = "extraction-elderly", settings: Record<string, unknown> = {}) {
  const result = fixture(sample);
  const scan = {
    createdAt: new Date().toISOString(), result, checks: [], images: [],
    review: { reviewedAt: new Date().toISOString(), pharmacistMode: false, original: result, confirmedCount: 0, stillFlagged: 0, generalNote: "", medicineNotes: [] },
  };
  // Only on the first page load of the test, so later changes (and reloads) are kept.
  await context.addInitScript(([s, st]) => {
    if (sessionStorage.getItem("e2e:ready")) return;
    sessionStorage.setItem("e2e:ready", "1");
    sessionStorage.setItem("nuskha:current-scan", s);
    localStorage.setItem("nuskha:settings", st);
  }, [JSON.stringify(scan), JSON.stringify(settings)] as const);
}

/** Nothing may stick out sideways on a 360 px screen (no sideways scrolling). */
export async function expectNoSidewaysScroll(page: Page) {
  const { scroll, width, offenders } = await page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const inScroller = (el: Element) => {
      for (let p = el.parentElement; p; p = p.parentElement) if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowX)) return true;
      return false;
    };
    const out = [...document.querySelectorAll("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.right > w + 1 || r.left < -1) && !inScroller(el) && !el.closest(".sr-only, dialog:not([open])");
      })
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`);
    return { scroll: document.documentElement.scrollWidth, width: w, offenders: out };
  });
  expect(offenders, "elements sticking out of the screen").toEqual([]);
  expect(scroll).toBeLessThanOrEqual(width);
}
