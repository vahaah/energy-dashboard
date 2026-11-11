import { expect, test, type Page } from "@playwright/test";

const WIDTHS = [1280, 1024, 768, 375] as const;
const THEMES = ["dark", "light"] as const;

async function prepare(page: Page, theme: (typeof THEMES)[number], width: number) {
  await page.addInitScript((stored: string) => {
    localStorage.setItem("grid-theme", stored);
  }, theme);
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  await page.emulateMedia({ colorScheme: theme });
}

test.describe("balancing widgets", () => {
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      test(`${theme} ${width} range, method link and home card`, async ({ page }) => {
        await prepare(page, theme, width);
        await page.goto("/system/balancing", { waitUntil: "networkidle" });
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          "What does it cost to keep Britain's electricity in balance?",
        );
        await expect(page.getByText("an estimate, not an invoice").first()).toBeVisible();
        await expect(page.getByText("Estimate", { exact: true }).first()).toBeVisible();
        await expect(page.getByText("Provisional").first()).toBeVisible();
        const method = page.getByRole("link", { name: "Method", exact: true });
        await method.click();
        await expect(page.locator("#household")).toBeInViewport();
        await expect(page.getByText("2,700 kWh")).toBeVisible();

        for (const label of ["1y", "FY", "All", "90d"]) {
          await page.getByRole("button", { name: label, exact: true }).click();
          await expect(page.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
          await expect(page.getByText("Estimated value of electricity traded with our neighbours").first()).toBeVisible();
        }

        const scrollWidth = await page.evaluate(() => document.scrollingElement?.scrollWidth ?? 0);
        expect(scrollWidth).toBeLessThanOrEqual(width);

        await page.goto("/", { waitUntil: "networkidle" });
        const card = page.locator("[data-balancing-card]");
        await expect(card).toBeVisible();
        await expect(card).toContainText("£");
        await expect(page.getByRole("link", { name: "Balancing" })).toHaveAttribute("href", "/system/balancing");
        const homeScroll = await page.evaluate(() => document.scrollingElement?.scrollWidth ?? 0);
        expect(homeScroll).toBeLessThanOrEqual(width);
      });
    }
  }
});
