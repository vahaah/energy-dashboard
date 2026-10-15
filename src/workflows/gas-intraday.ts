import {
  fetchGasIntradayStep,
  publishGasIntradayStep,
  takeGasSlotStep,
  validateGasIntradayStep,
} from "@/workflows/steps/gas";

/**
 * Hourly NTS intraday bundle. Four steps, sequential.
 * Success path: 9 workflow events × 24 runs = 216. Tinybird ops: 0.
 * A fatal step leaves releases/gas/latest.json on the previous release.
 */
export async function gasIntraday(slot: string, owner: string, nowIso: string) {
  "use workflow";
  await takeGasSlotStep(slot, owner);
  const fetched = await fetchGasIntradayStep(nowIso);
  await validateGasIntradayStep(fetched.hash, nowIso);
  await publishGasIntradayStep(fetched.hash, nowIso);
}
