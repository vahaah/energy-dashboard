import { revalidatePath, revalidateTag } from "next/cache";
import { dangerouslyDeleteByTag } from "@vercel/functions";
import { DASHBOARD_CACHE_TAG } from "@/lib/cache-tags";
import { DASHBOARD_PERIODS } from "@/lib/dashboard-period";
import { COMMODITY_RANGES } from "@/lib/dashboard-search-params";
import { loadDashboardPayload } from "@/lib/dashboard-payload";
import { getPricesQueryParams } from "@/lib/dashboard-data";
import { getLookAhead } from "@/lib/forecasts";
import { bumpCacheEpoch, bumpHistoricalCacheEpoch } from "@/lib/redis-cache";
import { queryPipe } from "@/lib/tinybird";
import type { CommodityPrice } from "@/lib/types";

export async function warmHotDashboardKeys(now = new Date()): Promise<void> {
  const tasks: Array<Promise<unknown>> = [
    ...DASHBOARD_PERIODS.map((period) => loadDashboardPayload({ period, now })),
    ...COMMODITY_RANGES.map((range) =>
      queryPipe<CommodityPrice>("prices_range", getPricesQueryParams(range, now), {
        range,
        now,
      })
    ),
    getLookAhead(),
  ];

  await Promise.all(
    tasks.map((task) =>
      task.then(
        () => undefined,
        () => undefined
      )
    )
  );
}

export async function invalidateAndWarm(
  now = new Date(),
  options?: { historical?: boolean }
): Promise<void> {
  try {
    revalidateTag(DASHBOARD_CACHE_TAG, { expire: 0 });
    revalidatePath("/");
    revalidatePath("/api/dashboard");
    await bumpCacheEpoch();
    if (options?.historical) {
      await bumpHistoricalCacheEpoch();
    }
    try {
      await dangerouslyDeleteByTag(DASHBOARD_CACHE_TAG);
    } catch {
      // Local and CI have no Vercel purge credentials.
    }
    await warmHotDashboardKeys(now);
  } catch {
    return;
  }
}
