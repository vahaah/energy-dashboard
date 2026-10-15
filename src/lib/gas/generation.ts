import { getHeadlineGenerationQueryParams } from "@/lib/dashboard-data";
import type { Generation5min } from "@/lib/types";
import { peekWarmedPipe } from "@/lib/warm-envelope";

/**
 * Gas-fired generation already stored on the warmed 24h envelope.
 * A miss returns null. This does not call Tinybird and does not add a pipe.
 */
export async function loadWarmedGasGeneration(now: Date): Promise<Generation5min[] | null> {
  return peekWarmedPipe<Generation5min>("generation_5min_range", getHeadlineGenerationQueryParams(now), {
    range: "24h",
    now,
  });
}
