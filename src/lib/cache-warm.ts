import { revalidatePath, revalidateTag } from "next/cache";
import { dangerouslyDeleteByTag } from "@vercel/functions";
import { DASHBOARD_CACHE_TAG } from "@/lib/cache-tags";
import { loadDashboardPayload } from "@/lib/dashboard-payload";
import { DASHBOARD_PERIODS } from "@/lib/dashboard-period";
import {
  dashboardPayloadCacheKey,
  dashboardPayloadPolicy,
} from "@/lib/dashboard-payload-model";
import { NESO_HISTORIC_CACHE_TAG } from "@/lib/neso-historic";
import { getRedis, redisKeyFor } from "@/lib/redis-cache";
import { readTinybirdOps } from "@/lib/tinybird-ops";

/**
 * Successful publish. Freshness is the envelope overwrite, so this does not
 * bump the cache epoch. Epoch bump stays a manual kill switch.
 */
export async function publishAfterSuccess(
  now = new Date(),
  options?: { historical?: boolean }
): Promise<void> {
  await dropComposedDashboardPayloads();
  revalidateTag(DASHBOARD_CACHE_TAG, { expire: 0 });
  revalidatePath("/");
  revalidatePath("/today");
  revalidatePath("/prices/gas");
  revalidatePath("/api/dashboard");
  revalidatePath("/llms.txt");
  if (options?.historical) {
    revalidatePath("/records");
    revalidateTag(NESO_HISTORIC_CACHE_TAG, { expire: 0 });
  }
  try {
    await dangerouslyDeleteByTag(DASHBOARD_CACHE_TAG);
  } catch {
    // Local and CI have no Vercel purge credentials.
  }
  await rebuildDashboardDayPayload(now);
  const ops = await readTinybirdOps(now);
  console.info("[workflow] publish", { ops });
}

async function rebuildDashboardDayPayload(now: Date): Promise<void> {
  if (!getRedis()) {
    return;
  }
  try {
    await loadDashboardPayload({ period: "day", now });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[workflow] dashboard day rebuild failed", message);
  }
}

export async function dropComposedDashboardPayloads(): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    return;
  }

  const keys: string[] = [];
  for (const period of DASHBOARD_PERIODS) {
    const policy = dashboardPayloadPolicy(period);
    const logical = dashboardPayloadCacheKey(period, null);
    keys.push(await redisKeyFor(logical, policy.tier));
  }
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
