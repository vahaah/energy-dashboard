import { defineConfig, devices } from "@playwright/test";

const port = 3000;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

const browser = devices["Desktop Chrome"];

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Layout shards use two workers. The map project caps itself at one: two SwiftShader WebGL maps on one runner never go stable, and screenshot() burns the 45s timeout.
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "off",
    ...browser,
  },
  projects: [
    {
      name: "layout",
      testIgnore: /[/\\]map(?:-ready)?\.spec\.ts$/,
    },
    {
      name: "map",
      testMatch: /[/\\]map(?:-ready)?\.spec\.ts$/,
      fullyParallel: false,
      workers: 1,
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run start",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
