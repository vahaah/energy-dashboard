import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import {
  PLAUSIBLE_DATA_POLICY_URL,
  PLAUSIBLE_DOMAIN,
  PLAUSIBLE_EVENT_PATH,
  PLAUSIBLE_QUEUE_STUB,
  PLAUSIBLE_SCRIPT_PATH,
  PLAUSIBLE_UPSTREAM_EVENT,
  PLAUSIBLE_UPSTREAM_SCRIPT,
  isPlausibleEnabled,
} from "@/lib/plausible";

describe("Plausible", () => {
  it("loads only when VERCEL_ENV is production", () => {
    expect(isPlausibleEnabled("production")).toBe(true);
    expect(isPlausibleEnabled("preview")).toBe(false);
    expect(isPlausibleEnabled("development")).toBe(false);
    expect(isPlausibleEnabled(undefined)).toBe(false);
    expect(isPlausibleEnabled("")).toBe(false);

    const source = readFileSync(resolve(process.cwd(), "src/lib/plausible.ts"), "utf8");
    expect(source).toContain('vercelEnv === "production"');
    expect(source).not.toContain("NODE_ENV");
  });

  it("points the first-party proxy at the outbound-links and file-downloads script", () => {
    expect(PLAUSIBLE_DOMAIN).toBe("grid.vahaah.com");
    expect(PLAUSIBLE_SCRIPT_PATH).toBe("/js/script.js");
    expect(PLAUSIBLE_EVENT_PATH).toBe("/api/event");
    expect(PLAUSIBLE_UPSTREAM_SCRIPT).toBe(
      "https://plausible.io/js/script.outbound-links.file-downloads.js",
    );
    expect(PLAUSIBLE_UPSTREAM_EVENT).toBe("https://plausible.io/api/event");
    expect(PLAUSIBLE_DATA_POLICY_URL).toBe("https://plausible.io/data-policy");
    expect(PLAUSIBLE_QUEUE_STUB).toContain("window.plausible.q");
    expect(PLAUSIBLE_QUEUE_STUB).toContain(".push(arguments)");
  });

  it("queues custom events until the real script replaces the stub", () => {
    const sandbox: {
      window: { plausible?: ((...args: unknown[]) => void) & { q?: unknown[] } };
    } = { window: {} };
    runInNewContext(PLAUSIBLE_QUEUE_STUB, sandbox);
    sandbox.window.plausible?.("pageview", { props: { path: "/" } });
    const queued = sandbox.window.plausible?.q?.[0];
    expect(Array.from(queued as ArrayLike<unknown>)).toEqual([
      "pageview",
      { props: { path: "/" } },
    ]);

    runInNewContext(PLAUSIBLE_QUEUE_STUB, sandbox);
    expect(sandbox.window.plausible?.q).toHaveLength(1);
  });

  it("rewrites /js/script.js and /api/event to Plausible and leaves the homepage static", async () => {
    const rewrites = nextConfig.rewrites ? await nextConfig.rewrites() : [];
    expect(rewrites).toEqual([
      { source: PLAUSIBLE_SCRIPT_PATH, destination: PLAUSIBLE_UPSTREAM_SCRIPT },
      { source: PLAUSIBLE_EVENT_PATH, destination: PLAUSIBLE_UPSTREAM_EVENT },
    ]);

    const layout = readFileSync(resolve(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(layout).toContain('from "next/script"');
    expect(layout).toContain("isPlausibleEnabled()");
    expect(layout).toContain('strategy="afterInteractive"');
    expect(layout.match(/strategy="afterInteractive"/g)).toHaveLength(2);
    expect(layout).toContain("data-domain={PLAUSIBLE_DOMAIN}");
    expect(layout).toContain("data-api={PLAUSIBLE_EVENT_PATH}");
    expect(layout).toContain("src={PLAUSIBLE_SCRIPT_PATH}");
    expect(layout).toContain("{PLAUSIBLE_QUEUE_STUB}");
    expect(layout).not.toContain("cookies(");
    expect(layout).not.toContain("headers(");
    expect(layout).not.toContain("connection(");

    const home = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(home).toContain('export const dynamic = "force-static"');
    expect(home).toContain("export const revalidate = 300");
  });
});
