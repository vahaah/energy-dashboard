import { expect, test, type Page } from "@playwright/test";
import {
  axisLineRuns,
  decodePng,
  glyphSpan,
  landEdgePixels,
  straightLandSeaEdge,
  pageBackgroundPixels,
  paletteOf,
  sampleMatch,
  type ImageRegion,
  type Rgb,
} from "./png-sample";

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

const LAND: Record<(typeof THEMES)[number], Rgb> = {
  light: [243, 241, 236],
  dark: [44, 46, 50],
};

const SEA: Record<(typeof THEMES)[number], Rgb> = {
  light: [197, 215, 230],
  dark: [13, 27, 39],
};

const WALES = { longitude: -3.84521, latitude: 52.04742 };
const INLAND = { longitude: -1.8, latitude: 52.6 };
const OPEN_SEA = { longitude: 3.85, latitude: 55.4 };

type Box = { x: number; y: number; width: number; height: number };

test.use({
  launchOptions: {
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  },
});

async function prepare(page: Page, theme: (typeof THEMES)[number], width: number, height: number) {
  await page.addInitScript((stored: string) => {
    localStorage.setItem("grid-theme", stored);
  }, theme);
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ colorScheme: theme });
}

async function hookNumber(page: Page, method: "labelCount" | "flowLineCount" | "flowMarkerCount"): Promise<number> {
  return page.locator("[data-map-status=ready]").evaluate((element, name) => {
    const host = element as HTMLElement & {
      __gridMapTest?: {
        labelCount: () => number;
        flowLineCount: () => number;
        flowMarkerCount: () => number;
      };
    };
    return host.__gridMapTest?.[name]() ?? 0;
  }, method);
}

async function project(page: Page, longitude: number, latitude: number): Promise<{ x: number; y: number } | null> {
  return page.locator("[data-map-status=ready]").evaluate(
    (element, point) => {
      const host = element as HTMLElement & {
        __gridMapTest?: {
          project: (lng: number, lat: number) => { x: number; y: number } | null;
        };
      };
      return host.__gridMapTest?.project(point.longitude, point.latitude) ?? null;
    },
    { longitude, latitude },
  );
}

function boxesClose(left: Box, right: Box): void {
  expect(Math.abs(left.x - right.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(left.y - right.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(left.width - right.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(left.height - right.height)).toBeLessThanOrEqual(1);
}

async function assertView(page: Page, view: "flows" | "stations") {
  const title = view === "flows" ? "Flows across GB borders" : "Power stations in Britain";
  const radio = view === "flows" ? "Flows" : "Power stations";
  const empty = view === "flows" ? "Select a flow from the list." : "Select a station on the map.";
  const panel = view === "flows" ? "Flow details" : "Station details";
  const other = view === "flows" ? "Power stations in Britain" : "Flows across GB borders";
  await expect(page.getByRole("radio", { name: radio })).toBeChecked();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: other })).toHaveCount(0);
  const inspector = page.locator("[data-flow-inspector]");
  if (await inspector.isVisible()) {
    await expect(inspector).toHaveAttribute("aria-label", panel);
    await expect(inspector.getByText(empty)).toBeVisible();
  } else {
    await expect(page.locator("#flow-sheet-title")).toHaveText(panel);
    await expect(page.locator("[data-flow-sheet]").getByText(empty)).toBeVisible();
  }
}

async function assertBasemap(page: Page, theme: (typeof THEMES)[number], checkInk: boolean) {
  const container = page.locator("[data-map-status=ready]");
  await expect(container).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => hookNumber(page, "labelCount"), { timeout: 15_000 }).toBeGreaterThan(0);
  const limits = await container.evaluate((element) => {
    const host = element as HTMLElement & {
      maplibreMap?: {
        getMaxBounds: () => {
          getWest: () => number;
          getSouth: () => number;
          getEast: () => number;
          getNorth: () => number;
        } | null;
      };
    };
    const bounds = host.maplibreMap?.getMaxBounds();
    if (!bounds) {
      return null;
    }
    return {
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    };
  });
  expect(limits).not.toBeNull();
  // Schematic box: Viking 9.18°E, IFA2 49.12°N, and the GB frame stay inside the camera.
  expect(limits?.east).toBeGreaterThanOrEqual(14);
  expect(limits?.south).toBeLessThanOrEqual(47);
  expect(limits?.west).toBeLessThanOrEqual(-12);
  expect(limits?.north).toBeGreaterThanOrEqual(64);
  const frame = page.locator("[data-map-frame]");
  const canvas = container.locator(".maplibregl-canvas");
  const frameBox = await frame.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  const mapBox = await container.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  const canvasBox = await canvas.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  expect(mapBox.height).toBeGreaterThan(300);
  boxesClose(canvasBox, mapBox);
  boxesClose(mapBox, frameBox);
  const exclude = await page.evaluate(() => {
    const map = document.querySelector("[data-map-status]");
    if (!(map instanceof HTMLElement)) {
      return [];
    }
    const origin = map.getBoundingClientRect();
    const regions: {
      name: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }[] = [];
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
      add(control.getBoundingClientRect(), 8, "control");
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
  const landEdge = landEdgePixels(image, LAND[theme], 18, scaled);
  expect(landEdge.right).toBeLessThan(40);
  expect(landEdge.bottom).toBeLessThan(40);
  const continentEdge = straightLandSeaEdge(image, LAND[theme], SEA[theme], 18, scaled);
  expect(continentEdge.horizontal).toBeLessThan(Math.round(40 * scaleX));
  expect(continentEdge.vertical).toBeLessThan(Math.round(40 * scaleY));
  const windowLabels = await page.evaluate(() => {
    const hook = (window as Window & { __gridMapTest?: { labelCount: () => number } }).__gridMapTest;
    return {
      frozen: Object.isFrozen(hook),
      labels: hook?.labelCount() ?? -1,
    };
  });
  expect(windowLabels.frozen).toBe(true);
  expect(windowLabels.labels).toBeGreaterThan(0);
  const runs = axisLineRuns(image, COAST[theme], 42, Math.round(90 * scaleX));
  expect(runs.horizontal + runs.vertical).toBeLessThanOrEqual(2);
  if (!checkInk) {
    return;
  }
  const inland = await project(page, INLAND.longitude, INLAND.latitude);
  const sea = await project(page, OPEN_SEA.longitude, OPEN_SEA.latitude);
  expect(inland).not.toBeNull();
  expect(sea).not.toBeNull();
  if (inland && sea) {
    expect(sea.x).toBeGreaterThanOrEqual(4);
    expect(sea.x).toBeLessThan(canvasBox.width - 4);
    expect(sampleMatch(image, inland.x * scaleX, inland.y * scaleY, 4, LAND[theme], 22)).toBeGreaterThan(0.5);
    expect(sampleMatch(image, sea.x * scaleX, sea.y * scaleY, 4, SEA[theme], 22)).toBeGreaterThan(0.5);
  }
  const labelNames = await container.evaluate((element) => {
    const host = element as HTMLElement & {
      maplibreMap?: {
        queryRenderedFeatures: (geometry?: unknown, options?: { layers?: string[] }) => {
          properties?: { name1?: string };
        }[];
      };
    };
    return (
      host.maplibreMap
        ?.queryRenderedFeatures(undefined, { layers: ["names-overview", "names-country"] })
        .map((feature) => feature.properties?.name1 ?? "") ?? []
    );
  });
  expect(labelNames).toContain("Wales");
  const wales = await project(page, WALES.longitude, WALES.latitude);
  expect(wales).not.toBeNull();
  if (wales) {
    const span = glyphSpan(image, wales.x * scaleX, wales.y * scaleY, theme);
    expect(span).not.toBeNull();
    expect((span?.width ?? 0) / scaleX).toBeGreaterThanOrEqual(34);
    expect((span?.left ?? 0) / scaleX).toBeLessThan(wales.x);
    expect((span?.right ?? 0) / scaleX).toBeGreaterThan(wales.x + 8);
  }
}

for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    test(`${theme} ${viewport.width} /map flows and power stations paint the basemap`, async ({ page }) => {
      test.setTimeout(120_000);
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => {
        pageErrors.push(error.message);
      });
      page.on("console", (message) => {
        if (message.type() === "error" && message.text().includes("reading 'y'")) {
          pageErrors.push(message.text());
        }
      });
      await prepare(page, theme, viewport.width, viewport.height);
      await page.goto("/map", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("checkbox", { name: "Interconnectors" })).toBeChecked();
      await assertView(page, "flows");
      if (viewport.width === 1280) {
        await expect.poll(() => hookNumber(page, "flowLineCount"), { timeout: 15_000 }).toBeGreaterThan(0);
        await expect.poll(() => hookNumber(page, "flowMarkerCount"), { timeout: 15_000 }).toBeGreaterThan(0);
        await page.waitForTimeout(9_000);
        expect(await hookNumber(page, "flowLineCount")).toBeGreaterThan(0);
        expect(await hookNumber(page, "flowMarkerCount")).toBeGreaterThan(0);
      }
      await assertBasemap(page, theme, true);
      const scroll = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth + 1);
      const sheet = page.locator("[data-flow-sheet]");
      if (await sheet.isVisible()) {
        await sheet.evaluate((element) => {
          element.scrollTop = element.scrollHeight;
        });
        expect(await sheet.evaluate((element) => element.scrollTop)).toBeGreaterThan(40);
        await sheet.getByRole("radio", { name: "Power stations" }).evaluate((element) => {
          if (element instanceof HTMLInputElement) {
            element.click();
          }
        });
        await expect.poll(async () => sheet.evaluate((element) => element.scrollTop)).toBe(0);
      } else {
        await page.getByRole("radio", { name: "Power stations" }).click();
      }
      await expect(page.getByRole("checkbox", { name: "Power stations" })).toBeChecked();
      await assertView(page, "stations");
      await assertBasemap(page, theme, false);
      expect(pageErrors).toEqual([]);
    });
  }
}
