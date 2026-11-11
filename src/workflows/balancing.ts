import { fetchBalancingStep, publishBalancingStep, takeBalancingSlotStep, validateBalancingStep } from "@/workflows/steps/balancing";

/**
 * Daily balancing costs, BSUoS tariffs, and the interconnector trade estimate.
 * Four steps. Tinybird ops: 0.
 * A fatal step leaves the previous pointer in place.
 */
export async function balancingDaily(slot: string, owner: string, nowIso: string) {
  "use workflow";
  await takeBalancingSlotStep(slot, owner);
  const fetched = await fetchBalancingStep(nowIso);
  await validateBalancingStep(fetched);
  await publishBalancingStep(fetched, nowIso);
}
