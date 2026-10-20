import { expect, test } from "@playwright/test";

/**
 * Headless Chromium has no GPU. SwiftShader is what makes MapLibre's WebGL
 * context come up in CI the same way a software renderer does on a VM.
 */
test.use({
  viewport: { width: 1280, height: 800 },
  launchOptions: {
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  },
});

for (const theme of ["light", "dark"] as const) {
  test(`/map reaches ready in ${theme}, including power stations`, async ({ page }) => {
    const spriteUrls: string[] = [];
    let tiles = 0;
    page.on("response", (response) => {
      const url = response.url();
      if (url.includes("/basemap/sprites/") && response.ok()) {
        spriteUrls.push(url);
      }
      if (response.status() === 206 && url.includes("tiles/basemap/")) {
        tiles += 1;
      }
    });
    await page.addInitScript((stored: string) => {
      localStorage.setItem("grid-theme", stored);
    }, theme);
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/map", { waitUntil: "domcontentloaded" });
    const map = page.locator("[data-map-status]");
    await expect(map).toHaveAttribute("data-map-status", "ready", { timeout: 45_000 });
    await expect.poll(() => tiles, { timeout: 45_000 }).toBeGreaterThan(0);
    await expect(map).toHaveAttribute("data-map-status", "ready");
    await expect(page.getByText("The map did not load.")).toHaveCount(0);
    expect(spriteUrls.some((url) => url.includes(`/basemap/sprites/${theme}`))).toBe(true);

    const renderer = await page.evaluate(() => {
      const canvas = document.querySelector("canvas.maplibregl-canvas");
      if (!(canvas instanceof HTMLCanvasElement)) {
        return "";
      }
      const gl = canvas.getContext("webgl2");
      const ext = gl?.getExtension("WEBGL_debug_renderer_info");
      return ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
    });
    expect(renderer.toLowerCase()).toContain("swiftshader");

    await page.locator("aside").getByRole("radio", { name: "Power stations" }).click();
    await expect(page.locator("aside").getByRole("checkbox", { name: "Power stations" })).toBeChecked();
    await expect(map).toHaveAttribute("data-map-status", "ready");
    await expect(page.getByText("The map did not load.")).toHaveCount(0);

    const other = theme === "dark" ? "light" : "dark";
    await page.getByRole("button", { name: theme === "dark" ? "Switch to light theme" : "Switch to dark theme" }).click();
    await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${other}\\b`));
    await expect.poll(() => spriteUrls.some((url) => url.includes(`/basemap/sprites/${other}`)), { timeout: 45_000 }).toBe(true);
    await expect(map).toHaveAttribute("data-map-status", "ready");
    await expect(page.getByText("The map did not load.")).toHaveCount(0);
  });
}
