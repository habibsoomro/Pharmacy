import { expect, test } from "@playwright/test";
import { expectNoSidewaysScroll, useLanguage } from "./helpers";

/** The main journey in test mode: upload → check → summary → save → My prescriptions. */
test("scan, check, summary, save and delete", async ({ context, page, baseURL }) => {
  await useLanguage(context, baseURL!, "en");
  page.on("dialog", (d) => d.accept());

  // A small PDF "prescription", made by the browser itself.
  const maker = await context.newPage();
  await maker.setContent("<h1>Rx</h1><p style='font-size:28px'>Tab Coumadin 5mg 0+0+1</p>");
  const pdf = await maker.pdf({ format: "A5" });
  await maker.close();

  await page.goto("/scan");
  await page.setInputFiles("input[type=file]:not([capture])", { name: "rx.pdf", mimeType: "application/pdf", buffer: pdf });
  await expect(page.getByText("Page 1")).toBeVisible({ timeout: 20_000 });
  await page.getByText("Read prescription").click();
  await expect(page.locator("#consent-error")).toContainText("tick the box"); // consent is required
  await page.locator("label:has-text('AI service') input").check();
  await page.getByText("Read prescription").click();

  await page.waitForURL("**/review", { timeout: 30_000 });
  await page.getByText("Looks correct").click();
  await page.waitForURL("**/summary");
  await expect(page.locator("#card-safety")).toContainText("Coumadin");
  await expect(page.getByText("AI can make mistakes").first()).toBeVisible();
  await expectNoSidewaysScroll(page);

  await page.getByText("Save to My prescriptions").click();
  await expect(page.getByText("Saved in My prescriptions", { exact: true })).toBeVisible();
  await page.getByText("See all").click();
  await expect(page.getByText("1 saved")).toBeVisible();
  await page.getByRole("button", { name: "Delete all" }).click();
  await expect(page.getByText("No saved prescriptions yet.")).toBeVisible();
});

test("the AI routes refuse bad and foreign requests", async ({ request }) => {
  expect((await request.post("/api/extract", { data: {} })).status()).toBe(400);
  expect((await request.post("/api/translate", { data: "x", headers: { "content-type": "text/plain" } })).status()).toBe(415);
  expect((await request.post("/api/interactions", { data: {}, headers: { origin: "https://evil.example" } })).status()).toBe(403);
});

test("pages that don't exist show a friendly page", async ({ page }) => {
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});
