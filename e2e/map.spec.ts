import { expect, test, type Page } from "@playwright/test";
import { axisLineRuns, decodePng, pageBackgroundPixels, paletteOf, type ImageRegion, type Rgb } from "./png-sample";

const THEMES = ["light", "dark"] as const;
const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 1024, height: 900 },
  { width: 768, height: 900 },
  { width: 375, height: 812 },
] as const;

const COAST: Record<(typeof THEMES)[number], Rgb> = {
  light: [94, 109, 120],
  dark: [139, 152, 164],
};

async function prepare(page: Page, theme: (typeof THEMES)[number], width: number, height: number) {
  await page.addInitScript((stored: string) => {
    localStorage.setItem("grid-theme", stored);
  }, theme);
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ colorScheme: theme });
}

async function placeLabels(page: Page): Promise<number> {
  return page.locator("[data-map-status=ready]").evaluate((element) => {
    const host = element as HTMLElement & {
      maplibreMap?: {
        queryRenderedFeatures: (options: { layers: string[] }) => unknown[];
      };
    };
    const map = host.maplibreMap;
    if (!map) {
      return 0;
    }
    // The flow chevrons repaint continuously, so the map does not go idle.
    return map.queryRenderedFeatures({
      layers: ["names-overview", "names-country", "names-city", "names-town"],
    }).length;
  });
}

async function assertBasemap(page: Page, theme: (typeof THEMES)[number]) {
  const container = page.locator("[data-map-status=ready]");
  await expect(container).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => placeLabels(page), { timeout: 15_000 }).toBeGreaterThan(0);
  const box = await container.evaluate((element) => element.getBoundingClientRect());
  expect(box.height).toBeGreaterThan(300);
  const canvas = container.locator(".maplibregl-canvas");
  const canvasBox = await canvas.evaluate((element) => element.getBoundingClientRect());
  expect(Math.abs(canvasBox.height - box.height)).toBeLessThanOrEqual(2);
  const exclude = await page.evaluate(() => {
    const map = document.querySelector("[data-map-status]");
    if (!(map instanceof HTMLElement)) {
      return [];
    }
    const origin = map.getBoundingClientRect();
    const regions: { name: string; x: number; y: number; width: number; height: number }[] = [];
    const add = (rect: DOMRect, pad: number, name: string) => {
      const x = rect.left - origin.left - pad;
      const y = rect.top - origin.top - pad;
      const right = rect.right - origin.left + pad;
      const bottom = rect.bottom - origin.top + pad;
      regions.push({
        name,
        x: Math.max(0, Math.floor(x)),
        y: Math.max(0, Math.floor(y)),
        width: Math.ceil(right) - Math.max(0, Math.floor(x)),
        height: Math.ceil(bottom) - Math.max(0, Math.floor(y)),
      });
    };
    for (const control of map.querySelectorAll(".maplibregl-ctrl")) {
      add(control.getBoundingClientRect(), 6, "control");
    }
    const sheet = document.querySelector("[data-flow-sheet]");
    if (sheet instanceof HTMLElement) {
      add(sheet.getBoundingClientRect(), 2, "sheet");
    }
    return regions;
  });
  const png = await canvas.screenshot();
  const image = decodePng(png);
  const scaleX = image.width / canvasBox.width;
  const scaleY = image.height / canvasBox.height;
  const scaled: ImageRegion[] = exclude.map((region) => ({
    name: region.name,
    x: Math.floor(region.x * scaleX),
    y: Math.floor(region.y * scaleY),
    width: Math.ceil(region.width * scaleX),
    height: Math.ceil(region.height * scaleY),
  }));
  const palette = paletteOf(image);
  expect(palette.samples).toBeGreaterThan(100);
  expect(palette.distinct).toBeGreaterThanOrEqual(2);
  const pageColor = await page.evaluate(() => {
    const match = getComputedStyle(document.body).backgroundColor.match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (!match) {
      return [255, 255, 255] as [number, number, number];
    }
    return [Number(match[1]), Number(match[2]), Number(match[3])] as [number, number, number];
  });
  expect(pageBackgroundPixels(image, pageColor, scaled)).toBe(0);
  const runs = axisLineRuns(image, COAST[theme], 42, Math.round(90 * scaleX));
  expect(runs.horizontal + runs.vertical).toBeLessThanOrEqual(2);
}

for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    test(`${theme} ${viewport.width} /map flows and power stations paint the basemap`, async ({ page }) => {
      test.setTimeout(90_000);
      await prepare(page, theme, viewport.width, viewport.height);
      await page.goto("/map", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("checkbox", { name: "Interconnectors" })).toBeChecked();
      await assertBasemap(page, theme);
      const scroll = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth + 1);
      await page.getByRole("radio", { name: "Power stations" }).click();
      await expect(page.getByRole("checkbox", { name: "Power stations" })).toBeChecked();
      await assertBasemap(page, theme);
    });
  }
}
