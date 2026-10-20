import { publishAfterSuccess } from "@/lib/cache-warm";
import { publishMapElectricity } from "@/lib/map/flows-release";
import { publishMapStationsIfDue } from "@/lib/map/stations-publish";
import { stepStatus, type StepStatus } from "@/lib/step-status";

export async function publishStep(nowIso: string, historical: boolean): Promise<StepStatus> {
  "use step";
  await publishAfterSuccess(new Date(nowIso), { historical });
  if (!historical) {
    const now = new Date(nowIso);
    await publishMapElectricity(now).catch(() => undefined);
    await publishMapStationsIfDue(now).catch(() => undefined);
  }
  return stepStatus(true, 0, 0);
}

(publishStep as { maxRetries?: number }).maxRetries = 1;
