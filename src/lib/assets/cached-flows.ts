import { flowsForCode } from "@/lib/assets/flows";
import { getInterconnectorQueryParams } from "@/lib/dashboard-data";
import { TINYBIRD_CACHE_SECONDS } from "@/lib/tinybird-cache";
import { peekWarmedPipe } from "@/lib/warm-envelope";
import type { InterconnectorFlow } from "@/lib/types";

/** Same interval as the warmed 24h `interconnector_flows` envelope. */
export const WARMED_FLOW_REVALIDATE_SECONDS = TINYBIRD_CACHE_SECONDS.live;

let pending: Promise<InterconnectorFlow[] | null> | null = null;

export function resetCachedInterconnectorFlows(): void {
  pending = null;
}

/** Redis only. A miss stays empty and does not call Tinybird. Concurrent callers share one peek; the slot clears when it settles. */
export function peekCachedInterconnectorFlows(now = new Date()): Promise<InterconnectorFlow[] | null> {
  if (pending) {
    return pending;
  }
  const request = peekWarmedPipe<InterconnectorFlow>(
    "interconnector_flows",
    getInterconnectorQueryParams("24h", now),
    { range: "24h", now },
  )
    .catch(() => null)
    .finally(() => {
      if (pending === request) {
        pending = null;
      }
    });
  pending = request;
  return request;
}

export async function attachedFlows(code: string, now = new Date()): Promise<InterconnectorFlow[]> {
  const rows = await peekCachedInterconnectorFlows(now);
  return flowsForCode(code, rows ?? []);
}
