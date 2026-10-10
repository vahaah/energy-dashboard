import { filterPublicCommodityPrices } from "@/lib/commodity-series";
import { getPricesQueryParams } from "@/lib/dashboard-data";
import { queryPipe } from "@/lib/tinybird";
import type { CommodityPrice, CommodityRange } from "@/lib/types";

export async function loadCachedPublicPrices(
  range: CommodityRange,
  now = new Date()
): Promise<CommodityPrice[]> {
  return filterPublicCommodityPrices(
    await queryPipe<CommodityPrice>("prices_range", getPricesQueryParams(range, now), {
      range,
      now,
    })
  );
}
