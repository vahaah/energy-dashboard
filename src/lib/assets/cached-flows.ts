import { flowsForCode } from "@/lib/assets/flows";
import { getInterconnectorQueryParams } from "@/lib/dashboard-data";
import { peekWarmedPipe } from "@/lib/warm-envelope";
import type { InterconnectorFlow } from "@/lib/types";

let pending: Promise<InterconnectorFlow[] | null> | null = null;

export function resetCachedInterconnectorFlows(): void {
  pending = null;
}

/** Redis only. A miss stays empty and does not call Tinybird. */
export function peekCachedInterconnectorFlows(now = new Date()): Promise<InterconnectorFlow[] | null> {
  if (!pending) {
    pending = peekWarmedPipe<InterconnectorFlow>(
      "interconnector_flows",
      getInterconnectorQueryParams("24h", now),
      { range: "24h", now },
    ).catch(() => null);
  }
  return pending;
}

export async function attachedFlows(code: string, now = new Date()): Promise<InterconnectorFlow[]> {
  const rows = await peekCachedInterconnectorFlows(now);
  return flowsForCode(code, rows ?? []);
}
