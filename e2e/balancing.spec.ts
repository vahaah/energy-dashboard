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
        await expect(page.getByText("Not an invoice").first()).toBeVisible();
        await expect(page.getByText("Estimate", { exact: true }).first()).toBeVisible();
        await expect(page.getByText("Incomplete").first()).toBeVisible();
        await expect(page.getByText("Calendar year 2025").first()).toBeVisible();
        const method = page.getByRole("link", { name: "Method", exact: true });
        await method.click();
        await expect(page.locator("#household")).toBeInViewport();
        await expect(page.locator("#household").getByText("2,500 kWh").first()).toBeVisible();

        for (const label of ["1 year", "This financial year", "All", "90 days"]) {
          await page.getByRole("button", { name: label, exact: true }).first().click();
          await expect(page.getByRole("button", { name: label, exact: true }).first()).toHaveAttribute("aria-pressed", "true");
          await expect(page.getByText("Estimated value of electricity traded with GB's neighbours").first()).toBeVisible();
        }

        const scrollWidth = await page.evaluate(() => document.scrollingElement?.scrollWidth ?? 0);
        expect(scrollWidth).toBeLessThanOrEqual(width);

        await page.goto("/", { waitUntil: "networkidle" });
        const card = page.locator("[data-balancing-card]");
        await expect(card).toBeVisible();
        await expect(card).toContainText("£");
        await expect(page.getByRole("link", { name: "What balancing costs, and who pays" })).toHaveAttribute(
          "href",
          "/system/balancing",
        );
        const homeScroll = await page.evaluate(() => document.scrollingElement?.scrollWidth ?? 0);
        expect(homeScroll).toBeLessThanOrEqual(width);
      });
    }
  }
});
