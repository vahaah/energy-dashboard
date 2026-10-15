import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/cron-map-layers/route";
import { resetRedisClient } from "@/lib/redis-cache";

describe("GET /api/cron-map-layers", () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
    resetRedisClient();
  });

  it("fails closed, makes no Tinybird call, and is a daily cron", async () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/api/cron-map-layers/route.ts"), "utf8");
    const vercel = readFileSync(resolve(process.cwd(), "vercel.json"), "utf8");
    const proxy = readFileSync(resolve(process.cwd(), "src/proxy.ts"), "utf8");
    expect(source).toContain("isCronAuthorized");
    expect(source).toContain("runDnoLayerWatch");
    expect(source).not.toContain("queryPipe");
    expect(source).not.toContain("tinybird");
    expect(source).not.toContain("ingestRows");
    expect(vercel).toContain('"/api/cron-map-layers"');
    expect(vercel).toContain("20 5 * * *");
    expect(proxy).toContain('"/api/cron-map-layers"');

    const denied = await GET(new Request("http://localhost/api/cron-map-layers"));
    expect(denied.status).toBe(401);
  });
});
