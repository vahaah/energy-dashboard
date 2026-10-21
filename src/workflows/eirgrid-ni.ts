import {
  fetchNiStep,
  publishNiStep,
  takeNiSlotStep,
  validateNiStep,
} from "@/workflows/steps/eirgrid-ni";

/**
 * Hourly EirGrid / SONI / SEMO bundle for Northern Ireland.
 * Four steps. 24 runs a day. Tinybird ops: 0.
 * Each dashboard call retries on its own. A part that still fails keeps that
 * part's series from the previous release; the parts that succeeded publish.
 * A run that gets no part leaves releases/eirgrid-ni/latest.json in place.
 * workflow 4.8 compiles every collector into one step function and StartOptions
 * has no region. Production functions are lhr1 and fra1, so this run is not
 * pinned to dub1. The cron route prefers lhr1.
 */
export async function eirgridNi(slot: string, owner: string, nowIso: string) {
  "use workflow";
  await takeNiSlotStep(slot, owner);
  const fetched = await fetchNiStep(nowIso);
  await validateNiStep(fetched.hash, fetched.bundle);
  await publishNiStep(fetched.hash, nowIso, fetched.bundle);
}
