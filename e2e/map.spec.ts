import { expect, test, type Page } from "@playwright/test";
import { decodePng, paletteOf } from "./png-sample";

const THEMES = ["light", "dark"] as const;
const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 1024, height: 900 },
  { width: 768, height: 900 },
  { width: 375, height: 812 },
] as const;

async function prepare(page: Page, theme: (typeof THEMES)[number], width: number, height: number) {
  await page.addInitScript((stored: string) => {
    localStorage.setItem("grid-theme", stored);
  }, theme);
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ colorScheme: theme });
}

async function assertBasemap(page: Page) {
  const container = page.locator("[data-map-status=ready]");
  await expect(container).toBeVisible({ timeout: 20_000 });
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)));
      }),
  );
  const box = await container.evaluate((element) => element.getBoundingClientRect());
  expect(box.height).toBeGreaterThan(300);
  const canvas = container.locator(".maplibregl-canvas");
  const canvasBox = await canvas.evaluate((element) => element.getBoundingClientRect());
  expect(Math.abs(canvasBox.height - box.height)).toBeLessThanOrEqual(2);
  const png = await canvas.screenshot();
  const palette = paletteOf(decodePng(png));
  expect(palette.samples).toBeGreaterThan(100);
  expect(palette.distinct).toBeGreaterThanOrEqual(2);
  expect(palette.nonBackground).toBeGreaterThan(Math.floor(palette.samples * 0.02));
}

for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    test(`${theme} ${viewport.width} /map flows and power stations paint the basemap`, async ({ page }) => {
      test.setTimeout(90_000);
      const glyphs = page.waitForResponse(
        (response) => response.url().includes("/basemap/glyphs/") && response.ok(),
        { timeout: 30_000 },
      );
      await prepare(page, theme, viewport.width, viewport.height);
      await page.goto("/map", { waitUntil: "domcontentloaded" });
      await glyphs;
      await expect(page.getByRole("checkbox", { name: "Interconnectors" })).toBeChecked();
      await assertBasemap(page);
      const scroll = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth + 1);
      await page.getByRole("radio", { name: "Power stations" }).click();
      await expect(page.getByRole("checkbox", { name: "Power stations" })).toBeChecked();
      await assertBasemap(page);
    });
  }
}
