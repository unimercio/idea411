import { defineConfig, devices } from "@playwright/test";

/**
 * E2E test config.
 *
 * Required env vars (set in shell or .env.local, NOT committed):
 *   E2E_TEST_EMAIL=unimercio@gmail.com
 *   E2E_TEST_PASSWORD=...
 *
 * Optional:
 *   E2E_BASE_URL  default https://idea411.lovable.app
 *
 * Run:  bunx playwright install chromium   # one-time
 *       bunx playwright test
 */
const baseURL = process.env.E2E_BASE_URL ?? "https://idea411.lovable.app";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
});
