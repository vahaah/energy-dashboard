import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route(/pmtiles|blob\.vercel-storage\.com/i, (route) => route.abort());
});

test("homepage does not request maplibre or pmtiles", async ({ page }) => {
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));
  await page.goto("/", { waitUntil: "networkidle" });
  const joined = urls.join("\n");
  expect(joined).not.toMatch(/maplibre/i);
  expect(joined).not.toMatch(/pmtiles/i);
  expect(joined).not.toMatch(/blob\.vercel-storage\.com/i);
  expect(joined).not.toMatch(/\/search\/assets\.json/);
});

test("map page lists coverage, attribution, and a DNO layer that starts off", async ({ page }) => {
  const workerFailed: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("Worker failed to load")) {
      workerFailed.push(message.text());
    }
  });
  const worker = page.waitForResponse((response) => response.url().includes("/maplibre/maplibre-gl-worker.mjs"));
  await page.goto("/map", { waitUntil: "domcontentloaded" });
  expect((await worker).status()).toBe(200);
  expect(workerFailed).toEqual([]);
  await expect(page.getByText("The map shows Great Britain. Each layer lists its own coverage.")).toBeVisible();
  await expect(page.getByText("Contains OS data © Crown copyright and database right 2026")).toBeVisible();
  await expect(page.getByText(/not 100% accurate/)).toBeVisible();
  const dno = page.getByRole("checkbox", { name: /DNO licence areas/ });
  await expect(dno).not.toBeChecked();
  await dno.focus();
  await page.keyboard.press("Space");
  await expect(dno).toBeChecked();
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/\blive\b/i);
  await page.keyboard.press("Tab");
});

test("asset filters stay in the URL and the detail page shows capacity", async ({ page }) => {
  await page.goto("/assets?technology=nuclear", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/technology=nuclear/);
  const link = page.getByRole("link", { name: /Sizewell|Hinkley|Heysham|Hartlepool|Torness/ }).first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByRole("heading", { name: "Capacity history" })).toBeVisible();
  await expect(page.getByText("Contains OS data © Crown copyright and database right 2026")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Source records" })).toBeVisible();
});

test("search opens from the keyboard and links to an asset", async ({ page }) => {
  await page.goto("/assets", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Search assets" }).first().waitFor();
  const dialog = page.getByRole("dialog", { name: "Search assets" });
  await expect(async () => {
    if (await dialog.isVisible()) {
      return;
    }
    await page.keyboard.press("Control+k");
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass();
  const input = dialog.getByRole("combobox");
  await input.fill("Sizewell");
  const option = dialog.getByRole("option").first();
  await expect(option).toBeVisible();
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/assets\/ast_/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Sizewell/i);
});

test("clicking a search result closes the dialog", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Search assets" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Search assets" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("combobox").fill("Sizewell");
  const option = dialog.getByRole("option").first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(page).toHaveURL(/\/assets\/ast_/);
  await expect(page.getByRole("dialog", { name: "Search assets" })).toHaveCount(0);
});
