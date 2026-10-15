import {
  fetchNiStep,
  publishNiStep,
  takeNiSlotStep,
  validateNiStep,
} from "@/workflows/steps/eirgrid-ni";

/**
 * Hourly EirGrid / SONI / SEMO bundle for Northern Ireland.
 * Four steps. 24 runs a day. Tinybird ops: 0.
 * A fatal step leaves releases/eirgrid-ni/latest.json on the previous release.
 */
export async function eirgridNi(slot: string, owner: string, nowIso: string) {
  "use workflow";
  await takeNiSlotStep(slot, owner);
  const fetched = await fetchNiStep(nowIso);
  await validateNiStep(fetched.hash);
  await publishNiStep(fetched.hash, nowIso);
}
