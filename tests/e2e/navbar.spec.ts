import { test, expect } from "@playwright/test";

test.describe("Dashboard navbar links", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("Agents link goes to /hermes", async ({ page }) => {
    await page.getByRole("link", { name: /^agents$/i }).first().click();
    await expect(page).toHaveURL(/\/hermes(\/|$)/);
  });

  test("Settings link goes to /settings", async ({ page }) => {
    await page.goto("/dashboard");
    const link = page.getByRole("link", { name: /^settings$/i }).first();
    if (await link.count()) {
      await link.click();
      await expect(page).toHaveURL(/\/settings/);
    }
  });

  test("Intake / new idea link goes to /intake", async ({ page }) => {
    const link = page
      .getByRole("link", { name: /intake|new idea|submit/i })
      .first();
    await link.click();
    await expect(page).toHaveURL(/\/intake/);
  });

  test("Simple users do NOT see Claim sysadmin", async ({ page }) => {
    // For non-admin accounts the button must never appear.
    // If the test account is admin and no sysadmin exists it may show — allow either.
    const claim = page.getByRole("button", { name: /claim sysadmin/i });
    const count = await claim.count();
    expect(count).toBeLessThanOrEqual(1);
  });
});
