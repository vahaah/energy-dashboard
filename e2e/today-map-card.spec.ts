import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const VIEWPORTS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "1024", width: 1024, height: 900 },
  { name: "768", width: 768, height: 900 },
  { name: "375", width: 375, height: 812 },
] as const;

const THEMES = ["light", "dark"] as const;

const TILE_REQUEST = /pmtiles|blob\.vercel-storage|\.pbf(?:$|\?)|\/tiles\/|maplibre/i;

async function prepare(page: Page, theme: (typeof THEMES)[number], width: number, height: number) {
  await page.addInitScript((stored: string) => {
    localStorage.setItem("grid-theme", stored);
  }, theme);
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ colorScheme: theme });
}

test.beforeAll(async () => {
  await mkdir("test-results/layout", { recursive: true });
});

for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    test(`today map card ${theme} ${viewport.name} is a static link with no tile requests`, async ({ page }) => {
      const tiles: string[] = [];
      page.on("request", (request) => {
        const url = request.url();
        if (TILE_REQUEST.test(url)) {
          tiles.push(url);
        }
      });
      await prepare(page, theme, viewport.width, viewport.height);
      await page.goto("/", { waitUntil: "networkidle" });
      const card = page.locator("#section-published-map");
      await expect(card).toBeVisible();
      await expect(card.getByRole("heading", { name: "Power infrastructure in GB" })).toBeVisible();
      await expect(card.getByText("What is built and what is in the pipeline, from the public registers.")).toBeVisible();
      await expect(card.getByText("England, Scotland and Wales.")).toBeVisible();
      await expect(card.getByText("Consent does not mean a project will be built.")).toBeVisible();
      await expect(card.getByText(/Rated capacity is not published for [\d,]+ projects\. The gigawatts are the published total\./)).toBeVisible();
      await expect(card.getByText("REPD Q2 2026 · DUKES May 2026")).toBeVisible();
      await expect(card.getByText("Contains public sector information licensed under the Open Government Licence v3.0.")).toBeVisible();
      const text = (await card.innerText()).toLowerCase();
      expect(text).not.toContain("live map");
      expect(text).not.toContain("digital twin");
      expect(text).not.toContain("power flows");

      const link = card.getByRole("link", { name: "Open map →" });
      await expect(link).toHaveAttribute("href", "/map");
      const list = card.getByRole("link", { name: "View as list" });
      await expect(list).toHaveAttribute("href", "/assets");
      const image = card.locator("img:visible");
      await expect(image).toHaveAttribute("src", theme === "dark" ? "/today/map-dark.png" : "/today/map-light.png");
      await expect(image).toHaveAttribute("loading", "lazy");
      await expect(image).toHaveAttribute(
        "alt",
        /Map of Great Britain showing [\d,]+ operating power sites, [\d.]+ GW in total\. Gas, offshore wind and onshore wind are the largest by capacity\./,
      );
      await image.scrollIntoViewIfNeeded();
      const natural = await image.evaluate(async (element) => {
        const img = element instanceof HTMLImageElement ? element : null;
        if (!img) {
          return null;
        }
        if (!img.complete || img.naturalWidth === 0) {
          await img.decode();
        }
        return { width: img.naturalWidth, height: img.naturalHeight, complete: img.complete };
      });
      expect(natural?.complete).toBe(true);
      expect(natural?.width).toBeGreaterThan(0);
      expect(natural?.height).toBeGreaterThan(0);

      await link.scrollIntoViewIfNeeded();
      await link.evaluate((element) => {
        if (element instanceof HTMLElement) {
          element.focus({ focusVisible: true } as FocusOptions);
        }
      });
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(link).toBeFocused();
      const ring = await link.evaluate((element) => {
        const style = getComputedStyle(element);
        return { outline: style.outlineStyle, width: style.outlineWidth, shadow: style.boxShadow };
      });
      expect(ring.shadow !== "none" || (ring.outline !== "none" && ring.width !== "0px")).toBe(true);

      const box = await card.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(-1);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      }
      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth - root.clientWidth;
      });
      expect(overflow).toBeLessThanOrEqual(1);
      expect(tiles, tiles.join("\n")).toEqual([]);
      await card.screenshot({
        path: `test-results/layout/today-map-${theme}-${viewport.width}.png`,
      });
    });
  }
}
