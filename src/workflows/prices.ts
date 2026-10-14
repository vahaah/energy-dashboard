import { FatalError } from "workflow";
import { publishStep } from "@/workflows/steps/publish";
import {
  fetchEiaStep,
  fetchPinkSheetStep,
  fetchSapStep,
  postPricesStep,
} from "@/workflows/steps/prices";
import { takeSlotStep } from "@/workflows/steps/slot";
import { warmPipeStep } from "@/workflows/steps/warm";

const LONG_PIPE_IDS = [
  "snapshots_range:30d",
  "snapshots_range:90d",
  "snapshots_range:1y",
  "generation_5min_range:30d",
  "generation_5min_range:90d",
  "generation_5min_range:1y",
  "prices_range:30d",
  "prices_range:90d",
  "prices_range:1y",
] as const;

/** EIA, Pink Sheet, SAP, one commodity_prices post, then nine long pipes. */
export async function pricesSlot(slot: string, owner: string, nowIso: string) {
  "use workflow";
  await takeSlotStep("prices", slot, owner);
  await fetchEiaStep(slot, nowIso);
  await fetchPinkSheetStep(slot, nowIso);
  await fetchSapStep(slot, nowIso);
  const posted = await postPricesStep(slot, nowIso);
  await warmPipeStep(LONG_PIPE_IDS[0], nowIso);
  await warmPipeStep(LONG_PIPE_IDS[1], nowIso);
  await warmPipeStep(LONG_PIPE_IDS[2], nowIso);
  await warmPipeStep(LONG_PIPE_IDS[3], nowIso);
  await warmPipeStep(LONG_PIPE_IDS[4], nowIso);
  await warmPipeStep(LONG_PIPE_IDS[5], nowIso);
  await warmPipeStep(LONG_PIPE_IDS[6], nowIso);
  await warmPipeStep(LONG_PIPE_IDS[7], nowIso);
  await warmPipeStep(LONG_PIPE_IDS[8], nowIso);
  await publishStep(nowIso, false);
  if (!posted.ok) {
    console.error("[workflow] prices required source failed", { slot });
    throw new FatalError("required price source failed");
  }
}
