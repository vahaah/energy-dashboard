import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, preferredRegion } from "@/app/api/cron-power-cuts/route";

const SECRET = "cron-test-secret";

describe("GET /api/cron-power-cuts", () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    vi.restoreAllMocks();
  });

  it("fails closed before any upstream fetch when the blob token is missing", async () => {
    process.env.CRON_SECRET = SECRET;
    const denied = await GET(new Request("http://localhost/api/cron-power-cuts"));
    expect(denied.status).toBe(401);

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const missing = await GET(
      new Request("http://localhost/api/cron-power-cuts", {
        headers: { authorization: `Bearer ${SECRET}` },
      }),
    );
    expect(missing.status).toBe(503);
    const body = (await missing.json()) as { error?: string };
    expect(body.error).toBe("BLOB_READ_WRITE_TOKEN is not set");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("is every 15 minutes in London", () => {
    expect(preferredRegion).toBe("lhr1");
    const vercel = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8")) as {
      crons: { path: string; schedule: string }[];
      functions: Record<string, { regions?: string[] }>;
    };
    expect(vercel.crons.find((entry) => entry.path === "/api/cron-power-cuts")?.schedule).toBe("*/15 * * * *");
    expect(vercel.functions["src/app/api/cron-power-cuts/route.ts"]?.regions).toEqual(["lhr1"]);
    expect(readFileSync(resolve(process.cwd(), "src/proxy.ts"), "utf8")).toContain('"/api/cron-power-cuts"');
  });
});
