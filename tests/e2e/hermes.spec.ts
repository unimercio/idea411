import { test, expect } from "@playwright/test";

test.describe("/hermes UI", () => {
  test("loads without console errors and shows nav tabs", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/hermes");
    await expect(page).toHaveURL(/\/hermes/);

    // Header brand link (IdeaForge, not "Hermes")
    await expect(
      page.getByRole("link", { name: /ideaforge/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^hermes$/i }),
    ).toHaveCount(0);

    // Three tabs + New task
    for (const name of [/^tasks$/i, /^agents$/i, /^settings$/i, /new task/i]) {
      await expect(page.getByRole("link", { name }).first()).toBeVisible();
    }

    // Tabs navigate correctly
    await page.getByRole("link", { name: /^agents$/i }).first().click();
    await expect(page).toHaveURL(/\/hermes\/agents/);

    await page.getByRole("link", { name: /^settings$/i }).first().click();
    await expect(page).toHaveURL(/\/hermes\/settings/);

    await page.getByRole("link", { name: /^tasks$/i }).first().click();
    await expect(page).toHaveURL(/\/hermes(\/|$)/);

    // Filter out benign noise (favicon, hydration warnings from third-party)
    const fatal = errors.filter(
      (e) =>
        !/favicon|Failed to load resource.*404/i.test(e) &&
        !/Download the React DevTools/i.test(e),
    );
    expect(fatal, `Console errors:\n${fatal.join("\n")}`).toEqual([]);
  });
});
