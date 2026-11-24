import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route(/pmtiles|blob\.vercel-storage\.com/i, (route) => route.abort());
});

test("homepage does not request maplibre or pmtiles", async ({ page }) => {
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/", { waitUntil: "networkidle" });
  const mapLink = page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Map" });
  await expect(mapLink).toBeVisible();
  await mapLink.hover();
  await expect.poll(() => urls.some((url) => /\/map\?_rsc=/.test(url)), { timeout: 10_000 }).toBe(true);
  const joined = urls.join("\n");
  expect(joined).not.toMatch(/maplibre/i);
  expect(joined).not.toMatch(/pmtiles/i);
  expect(joined).not.toMatch(/blob\.vercel-storage\.com/i);
  expect(joined).not.toMatch(/\/search\/assets\.json/);
  expect(joined).not.toMatch(/\/search\/projects\.json/);
});

test("map is full bleed, starts on flows, and opens a link from the keyboard", async ({ page }) => {
  const workerFailed: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("Worker failed to load")) {
      workerFailed.push(message.text());
    }
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  const worker = page.waitForResponse((response) => response.url().includes("/maplibre/maplibre-gl-worker.mjs"));
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/map", { waitUntil: "domcontentloaded" });
  expect((await worker).status()).toBe(200);
  expect(workerFailed).toEqual([]);
  const stage = page.locator("[data-flows-stage]");
  const box = await stage.boundingBox();
  expect(box?.y ?? 999).toBeLessThan(120);
  expect(box?.height ?? 0).toBeGreaterThan(600);
  await expect(page.getByRole("heading", { name: "Flows across GB borders" })).toBeVisible();
  await expect(page.locator("aside").getByText("Straight line, not the cable route.")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Interconnectors" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Gas entry points" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Power stations" })).not.toBeChecked();
  const dno = page.getByRole("checkbox", { name: "DNO licence areas" });
  await expect(dno).not.toBeChecked();
  const first = page.locator("[data-flow-list] button").first();
  await first.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-flow-inspector]")).toContainText("Asset page");
  await page.keyboard.press("Escape");
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/\blive\b/i);
  expect(requests.join("\n")).not.toMatch(/tinybird|\/api\/interconnectors/i);
});

test("asset filters stay in the URL and the detail page shows capacity", async ({ page }) => {
  await page.goto("/assets?technology=nuclear", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/technology=nuclear/);
  const link = page.getByRole("link", { name: /Sizewell|Hinkley|Heysham|Hartlepool|Torness/ }).first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/assets\/ast_[a-f0-9]{16}\/[a-z0-9-]+$/);
  await expect(page.getByRole("heading", { name: "Change history" })).toBeVisible();
  await expect(page.getByText("Contains public sector information licensed under the Open Government Licence v3.0.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Source record" }).first()).toBeVisible();
});

test("search opens from the keyboard and links to an asset", async ({ page }) => {
  await page.goto("/assets", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Search", exact: true }).first().waitFor();
  const dialog = page.getByRole("dialog", { name: "Search", exact: true });
  await expect(async () => {
    if (await dialog.isVisible()) {
      return;
    }
    await page.keyboard.press("Control+k");
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass();
  const input = dialog.getByRole("combobox");
  await input.fill("Sizewell");
  const asset = dialog.locator("[role='option'][href^='/assets/']").first();
  await expect(asset).toBeVisible();
  for (let step = 0; step < 12; step += 1) {
    const href = await dialog.locator("[role='option'][aria-selected='true']").getAttribute("href");
    if (href?.startsWith("/assets/")) {
      break;
    }
    await input.press("ArrowDown");
  }
  await input.press("Enter");
  await expect(page).toHaveURL(/\/assets\/ast_[a-f0-9]{16}\/[a-z0-9-]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Sizewell/i);
});

test("search finds a planning project and a page", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const button = page.getByRole("button", { name: "Search", exact: true }).first();
  await button.waitFor();
  const dialog = page.getByRole("dialog", { name: "Search", exact: true });
  await button.click();
  await expect(dialog).toBeVisible();
  const input = dialog.getByRole("combobox");
  await input.fill("eurocell nickel");
  await expect(dialog.getByRole("option", { name: /Eurocell Nickel/ })).toBeVisible();
  await input.fill("price cap");
  const priceCap = dialog.getByRole("option", { name: /Price cap/ });
  await expect(priceCap).toBeVisible();
  await expect(priceCap).toHaveAttribute("href", "/explained/price-cap");
});

test("clicking a search result closes the dialog", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const button = page.getByRole("button", { name: "Search", exact: true }).first();
  await button.waitFor();
  const dialog = page.getByRole("dialog", { name: "Search", exact: true });
  await expect(async () => {
    if (await dialog.isVisible()) {
      return;
    }
    await button.click();
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass();
  await dialog.getByRole("combobox").fill("Sizewell");
  const option = dialog.locator("[role='option'][href^='/assets/']").first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(page).toHaveURL(/\/assets\/ast_[a-f0-9]{16}\/[a-z0-9-]+$/);
  await expect(page.getByRole("dialog", { name: "Search", exact: true })).toHaveCount(0);
});

test("asset pages do not request maplibre or tiles", async ({ page }) => {
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));
  await page.goto("/assets/ast_0003670fbf90f564/cuckoo-grove-farm", { waitUntil: "networkidle" });
  const joined = urls.join("\n");
  expect(joined).not.toMatch(/maplibre/i);
  expect(joined).not.toMatch(/pmtiles/i);
  expect(joined).not.toMatch(/blob\.vercel-storage\.com/i);
});

test("a wrong slug redirects and an unknown id is missing", async ({ request }) => {
  const wrong = await request.get("/assets/ast_5c5dc7c6656c3f93/not-ifa", { maxRedirects: 0 });
  expect(wrong.status()).toBe(308);
  expect(wrong.headers().location ?? "").toContain("/assets/ast_5c5dc7c6656c3f93/ifa");
  const bare = await request.get("/assets/ast_5c5dc7c6656c3f93", { maxRedirects: 0 });
  expect(bare.status()).toBe(308);
  expect(bare.headers().location ?? "").toContain("/assets/ast_5c5dc7c6656c3f93/ifa");
  const missing = await request.get("/assets/ast_0000000000000000/missing", { maxRedirects: 0 });
  expect(missing.status()).toBe(404);
});

test("the map inspector links to the canonical asset", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/map", { waitUntil: "domcontentloaded" });
  await page.locator("aside [data-flow-list] button").filter({ hasText: /^IFA\b/ }).click();
  const inspector = page.locator("[data-flow-inspector]");
  await expect(inspector.getByRole("link", { name: "Asset page →" })).toHaveAttribute(
    "href",
    "/assets/ast_5c5dc7c6656c3f93/ifa",
  );
  await expect(inspector).toContainText("Sellindge");
  await expect(page.locator("aside").getByText("Straight line, not the cable route.")).toBeVisible();
});
