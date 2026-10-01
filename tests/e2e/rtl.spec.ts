import { expect, test } from "@playwright/test";
import { expectNoSidewaysScroll, useLanguage, withScan } from "./helpers";

/**
 * Urdu and Sindhi on a 360 px wide phone (brief, section 11): every page must be
 * right-to-left, use the right font, and never scroll sideways.
 */
const PAGES = ["/", "/scan", "/review", "/summary", "/history", "/about", "/contact", "/privacy"];

for (const lang of ["ur", "sd"] as const) {
  test.describe(`${lang === "ur" ? "Urdu" : "Sindhi"} at 360 px`, () => {
    test.beforeEach(async ({ context, baseURL }) => {
      await useLanguage(context, baseURL!, lang);
      await withScan(context);
    });

    for (const path of PAGES) {
      test(`${path} is right-to-left and fits the screen`, async ({ page }, info) => {
        await page.goto(path);
        await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
        await expect(page.locator("html")).toHaveAttribute("lang", lang);
        if (path === "/summary") await page.waitForSelector("#card-interactions");
        if (path === "/review") await page.waitForSelector("#main h1");
        await page.waitForLoadState("networkidle");
        const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
        expect(font).toContain(lang === "ur" ? "Nastaliq" : "Naskh");
        await expectNoSidewaysScroll(page);
        await page.screenshot({ path: info.outputPath(`${lang}-${path === "/" ? "home" : path.slice(1)}.png`), fullPage: true });
      });
    }

    test("summary: times of day run right to left, medicine names stay in English", async ({ page }) => {
      await page.goto("/summary");
      const slots = page.locator("#card-med-0 [role=listitem]");
      const morning = await slots.nth(0).boundingBox();
      const night = await slots.nth(3).boundingBox();
      expect(morning!.x).toBeGreaterThan(night!.x); // morning is on the right in RTL
      const name = page.locator("#card-med-0 bdi.latin").first();
      await expect(name).toHaveAttribute("dir", "ltr");
      await expect(name).toContainText("Coumadin");
    });

    test("settings panel and Extra-large text still fit", async ({ page }) => {
      await page.goto("/summary");
      await page.locator("header button[aria-haspopup=dialog]").click();
      await expect(page.locator("dialog[open]")).toBeVisible();
      await expectNoSidewaysScroll(page);
      await page.keyboard.press("Escape");
      await page.evaluate(() => localStorage.setItem("nuskha:settings", JSON.stringify({ textSize: "xl", view: "pharmacist", level: "detailed" })));
      await page.reload();
      await page.waitForSelector("#card-dispensing");
      await expectNoSidewaysScroll(page);
    });
  });
}

test("a summary-only language (Pashto) is right-to-left inside an English website", async ({ context, page, baseURL }) => {
  await useLanguage(context, baseURL!, "en");
  await withScan(context, "extraction-elderly", { summaryLang: "ps" });
  await page.goto("/summary");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.locator("main [dir=rtl][lang=ps]").first()).toBeVisible();
  await page.waitForFunction(() => document.body.innerText.includes("[ps]"), null, { timeout: 20_000 }); // test-mode translation marker
  await expectNoSidewaysScroll(page);
});
