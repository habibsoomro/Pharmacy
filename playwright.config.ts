import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests (npm run test:e2e). They build the site, start it in test mode
 * (AI_MOCK, no AI calls, no API key needed) and check it on a 360 px wide phone screen.
 * First time on a new computer: npx playwright install chromium
 */
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1, // one server, shared rate limits: run one test at a time
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Pixel 5"],
    viewport: { width: 360, height: 780 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "phone-360", use: { browserName: "chromium" } }],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: { AI_MOCK: "elderly" },
  },
});
