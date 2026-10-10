import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { yesterdayLondonDate } from "@/lib/london-time";

describe("yesterday settlement heal", () => {
  it("uses the previous London calendar date, including across BST", () => {
    expect(yesterdayLondonDate(new Date("2026-09-28T02:00:00.000Z"))).toBe("2026-09-27");
    expect(yesterdayLondonDate(new Date("2026-03-29T10:00:00.000Z"))).toBe("2026-03-28");
  });

  it("schedules a daily Vercel cron and excludes it from the public rate limit", () => {
    const vercel = readFileSync(resolve(process.cwd(), "vercel.json"), "utf8");
    const proxy = readFileSync(resolve(process.cwd(), "src/proxy.ts"), "utf8");
    const route = readFileSync(
      resolve(process.cwd(), "src/app/api/cron-yesterday/route.ts"),
      "utf8"
    );

    expect(vercel).toContain('"/api/cron-yesterday"');
    expect(vercel).toContain("30 9 * * *");
    expect(proxy).toContain('"/api/cron-yesterday"');
    expect(route).toContain("collectSnapshotsForSettlementDate(settlementDate, now)");
    expect(route).toContain("collectGenerationForSettlementDate(settlementDate, now)");
    expect(route).toContain("yesterdayLondonDate");
    expect(route).toContain("sourceStatusesHaveFailure");
    expect(route).toContain("status: failed ? 503 : 200");
    expect(route).toContain("invalidateAndWarm(now, { historical: true })");
    expect(route).not.toContain('revalidateTag(DASHBOARD_CACHE_TAG, "max")');

    const warmer = readFileSync(resolve(process.cwd(), "src/lib/cache-warm.ts"), "utf8");
    expect(warmer).toContain("revalidateTag(DASHBOARD_CACHE_TAG, { expire: 0 })");
    expect(warmer).toContain('revalidatePath("/api/dashboard")');
    expect(warmer).toContain("dangerouslyDeleteByTag(DASHBOARD_CACHE_TAG)");
    expect(warmer).toContain("scheduleBackground");
    expect(warmer.indexOf("revalidateTag")).toBeLessThan(warmer.indexOf("bumpHistoricalCacheEpoch"));
    expect(warmer.indexOf("bumpHistoricalCacheEpoch")).toBeLessThan(
      warmer.indexOf("warmHotDashboardKeys")
    );

    const tinybird = readFileSync(resolve(process.cwd(), "src/lib/tinybird.ts"), "utf8");
    expect(tinybird).toContain("if (redisEnvPresent())");
    expect(tinybird).toContain("return loadPipeRows<T>(pipeName, params, logicalKey)");
  });
});
