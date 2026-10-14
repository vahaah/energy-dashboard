import { publishStep } from "@/workflows/steps/publish";
import { takeSlotStep } from "@/workflows/steps/slot";
import {
  fetchYesterdayGenerationStep,
  fetchYesterdaySnapshotsStep,
  postYesterdayGenerationStep,
  postYesterdaySnapshotsStep,
} from "@/workflows/steps/yesterday";

/** Settlement-date rewrite and two Events posts. Does not query pipes. */
export async function yesterdayHeal(slot: string, owner: string, nowIso: string) {
  "use workflow";
  await takeSlotStep("yesterday", slot, owner);
  await fetchYesterdaySnapshotsStep(slot, nowIso);
  await fetchYesterdayGenerationStep(slot, nowIso);
  await postYesterdaySnapshotsStep(slot, nowIso);
  await postYesterdayGenerationStep(slot, nowIso);
  await publishStep(nowIso, true);
}
