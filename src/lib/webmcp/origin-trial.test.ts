import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const ENV_KEY = "WEBMCP_ORIGIN_TRIAL_TOKEN";

async function loadToken(): Promise<string> {
  vi.resetModules();
  const mod = await import("./origin-trial");
  return mod.WEBMCP_ORIGIN_TRIAL_TOKEN;
}

describe("WebMCP origin trial token", () => {
  const previous = process.env[ENV_KEY];

  afterEach(() => {
    if (previous === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = previous;
    }
    vi.resetModules();
  });

  it("is empty when the variable is unset", async () => {
    delete process.env[ENV_KEY];
    expect(await loadToken()).toBe("");
  });

  it("is empty when the variable is blank", async () => {
    process.env[ENV_KEY] = "   ";
    expect(await loadToken()).toBe("");
  });

  it("trims a set token", async () => {
    process.env[ENV_KEY] = "  example-token  ";
    expect(await loadToken()).toBe("example-token");
  });

  it("keeps the homepage static and emits the meta tag only for a non-empty token", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/webmcp/origin-trial.ts"), "utf8");
    const layout = readFileSync(resolve(process.cwd(), "src/app/layout.tsx"), "utf8");
    const home = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(source).toContain("process.env.WEBMCP_ORIGIN_TRIAL_TOKEN");
    expect(source).toContain(".trim()");
    expect(source).not.toContain("console.");
    expect(layout).toContain("WEBMCP_ORIGIN_TRIAL_TOKEN ?");
    expect(layout).toContain('httpEquiv="origin-trial"');
    expect(home).toContain('export const dynamic = "force-static"');
    expect(home).toContain("export const revalidate = 300");
  });
});
