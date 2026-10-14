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
    expect(vercel).toContain('"/api/cron"');
    expect(vercel).toContain('"/api/cron-warm"');
    expect(vercel).toContain("*/30 * * * *");
    expect(vercel).toContain("30 */6 * * *");
    expect(proxy).toContain('"/api/cron-yesterday"');
    expect(proxy).toContain('"/api/cron-warm"');
    expect(proxy).toContain("/.well-known/workflow/");
    expect(route).toContain("start(yesterdayHeal");
    expect(route).toContain("isCronAuthorized");
    expect(route).not.toContain("ingestRows");
    expect(route).not.toContain("collectSnapshotsForSettlementDate");
    expect(route).not.toContain('revalidateTag(DASHBOARD_CACHE_TAG, "max")');

    const heal = readFileSync(
      resolve(process.cwd(), "src/workflows/steps/yesterday.ts"),
      "utf8"
    );
    expect(heal).toContain("collectSnapshotsForSettlementDate(settlementDate, now)");
    expect(heal).toContain("collectGenerationForSettlementDate(settlementDate, now)");
    expect(heal).toContain("yesterdayLondonDate");
    expect(heal).toContain("sourceStatusesHaveFailure");
    expect(heal).toContain("recordSnapshotIntegrity");
    expect(heal).toContain("shouldRecordSnapshotIntegrity");
    expect(heal).toContain("integrityReportForWrittenRows");
    expect(heal).toContain("integritySourceStatus");
    expect(heal).toContain("logSoftIntegrityFindings");
    const snapshotPost = heal.slice(
      heal.indexOf("export async function postYesterdaySnapshotsStep"),
      heal.indexOf("export async function postYesterdayGenerationStep")
    );
    expect(snapshotPost.indexOf('postTinybirdRows("energy_snapshots"')).toBeLessThan(
      snapshotPost.indexOf("recordSnapshotIntegrity")
    );
    expect(snapshotPost).toContain("snapshotIngestFailed");

    const hourly = readFileSync(resolve(process.cwd(), "src/app/api/cron/route.ts"), "utf8");
    expect(hourly).toContain("start(electricitySlot");
    expect(hourly).not.toContain("ingestRows");
    const electricityPost = readFileSync(
      resolve(process.cwd(), "src/workflows/steps/electricity-post.ts"),
      "utf8"
    );
    expect(electricityPost).toContain("integritySourceStatus");
    expect(electricityPost).toContain("logSoftIntegrityFindings");
    expect(electricityPost).toContain("emptyIntegrityReport");

    const warmer = readFileSync(resolve(process.cwd(), "src/lib/cache-warm.ts"), "utf8");
    expect(warmer).toContain("revalidateTag(DASHBOARD_CACHE_TAG, { expire: 0 })");
    expect(warmer).toContain('revalidatePath("/api/dashboard")');
    expect(warmer).toContain('revalidatePath("/records")');
    expect(warmer).toContain('revalidatePath("/today")');
    expect(warmer).toContain('revalidatePath("/prices/gas")');
    expect(warmer).toContain('revalidatePath("/llms.txt")');
    expect(warmer).toContain("NESO_HISTORIC_CACHE_TAG");
    expect(warmer).toContain("dangerouslyDeleteByTag(DASHBOARD_CACHE_TAG)");
    expect(warmer).not.toContain("scheduleBackground");
    expect(warmer).not.toContain("bumpCacheEpoch");
    expect(warmer).not.toContain("bumpHistoricalCacheEpoch");
    expect(warmer).not.toContain("warmHotDashboardKeys");

    const tinybird = readFileSync(resolve(process.cwd(), "src/lib/tinybird.ts"), "utf8");
    expect(tinybird).toContain("queryPipeDeduped");
    expect(tinybird).toContain("unstable_cache");
    expect(tinybird).not.toContain("if (redisEnvPresent())");
    expect(tinybird).not.toContain("loadPipeRows");
  });
});
