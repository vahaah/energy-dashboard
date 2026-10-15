import type { ConstraintsBundle } from "@/lib/constraints/release";
import {
  fetchConstraintsStep,
  publishConstraintsStep,
  takeConstraintsSlotStep,
  validateConstraintsStep,
} from "@/workflows/steps/constraints";

/**
 * Daily NESO constraint bundles. Four steps, sequential.
 * Breakdown once a day, day-ahead on weekdays: about 2 runs a day.
 * Success path: 9 workflow events per run. Tinybird ops: 0.
 * A fatal step leaves the previous pointer in place.
 */
export async function nesoConstraints(slot: string, owner: string, nowIso: string, bundle: ConstraintsBundle) {
  "use workflow";
  await takeConstraintsSlotStep(slot, owner);
  const fetched = await fetchConstraintsStep(bundle, nowIso);
  await validateConstraintsStep(fetched.hash, bundle, nowIso);
  await publishConstraintsStep(fetched.hash, bundle, nowIso);
}
