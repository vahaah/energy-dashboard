import {
  fetchCarbonStep,
  fetchElexonStep,
  fetchEmbeddedStep,
  fetchFuelinstStep,
} from "@/workflows/steps/electricity-fetch";
import { postGenerationStep, postSnapshotsStep } from "@/workflows/steps/electricity-post";
import { publishStep } from "@/workflows/steps/publish";
import { takeSlotStep } from "@/workflows/steps/slot";
import { warmPipeStep } from "@/workflows/steps/warm";

const LIVE_PIPE_IDS = [
  "snapshots_range:24h",
  "snapshots_range:7d",
  "generation_5min_range:24h",
  "generation_5min_range:7d",
  "interconnector_flows:24h",
  "interconnector_flows:7d",
] as const;

/**
 * On the hour: four fetches, two Events posts, then the six live pipes.
 * On the half-hour: the six pipes only. Steps run one after another.
 */
export async function electricitySlot(slot: string, owner: string, nowIso: string) {
  "use workflow";
  await takeSlotStep("electricity", slot, owner);
  if (slot.slice(14, 16) === "00") {
    await fetchCarbonStep(slot, nowIso);
    await fetchElexonStep(slot, nowIso);
    await fetchFuelinstStep(slot, nowIso);
    await fetchEmbeddedStep(slot, nowIso);
    await postSnapshotsStep(slot, nowIso);
    await postGenerationStep(slot, nowIso);
  }
  await warmPipeStep(LIVE_PIPE_IDS[0], nowIso);
  await warmPipeStep(LIVE_PIPE_IDS[1], nowIso);
  await warmPipeStep(LIVE_PIPE_IDS[2], nowIso);
  await warmPipeStep(LIVE_PIPE_IDS[3], nowIso);
  await warmPipeStep(LIVE_PIPE_IDS[4], nowIso);
  await warmPipeStep(LIVE_PIPE_IDS[5], nowIso);
  await publishStep(nowIso, false);
}
