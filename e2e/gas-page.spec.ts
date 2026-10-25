import { expect, test } from "@playwright/test";

test("shows a stale published time, partial and complete days, and the table without charts", async ({ page }) => {
  await page.goto("/gas");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Where is Britain's gas coming from, and where is it going?",
  );
  await expect(page.getByText("Updated hourly.")).toBeVisible();
  await expect(page.locator("[data-gas-day-state=partial]")).toBeVisible();
  await expect(page.locator("[data-gas-partial]")).toContainText("This gas day is not complete");
  await expect(page.locator("[data-gas-stale]")).toContainText("Latest gas data is from");
  await expect(page.locator("[data-gas-stale]")).toContainText("Grid checks every hour.");
  const published = page.locator('[data-clock="published"]');
  await expect(published).toBeVisible();
  await expect(published).toHaveAttribute("datetime", "2026-10-14T03:05:00.000Z");
  const tableToggle = page.getByRole("button", { name: "Show table" });
  await expect(tableToggle).toHaveAttribute("aria-expanded", "false");
  await tableToggle.click();
  await expect(page.locator("[data-gas-table]")).toBeVisible();

  await page.getByRole("button", { name: "Completed gas day" }).click();
  await expect(page.locator("[data-gas-day-state=complete]")).toBeVisible();
  await expect(page.locator("[data-gas-partial]")).toHaveCount(0);
  await expect(page.getByText("Completed gas day").first()).toBeVisible();
  await expect(page.locator("[data-comparison-basis=flow]")).toHaveCount(0);
});

test.describe("charts blocked", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps the supply and demand table in the page", async ({ page }) => {
    await page.goto("/gas");
    await expect(page.locator("[data-gas-table]")).toBeVisible();
    await expect(page.locator(".recharts-wrapper")).toHaveCount(0);
    await expect(page.getByText("Updated hourly.")).toBeVisible();
  });
});
