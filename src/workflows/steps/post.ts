import { jsonBytes, stepStatus, type StepStatus } from "@/lib/step-status";
import { ingestRows } from "@/lib/tinybird";
import { reserveTinybirdOp } from "@/lib/tinybird-ops";
import { toTinybirdStepError } from "@/lib/warm-pipes";

export async function postTinybirdRows(
  datasource: string,
  rows: Record<string, unknown>[],
  now: Date
): Promise<StepStatus> {
  if (rows.length === 0) {
    return stepStatus(true, 0, 0);
  }

  await reserveTinybirdOp(now);
  try {
    await ingestRows(datasource, rows);
  } catch (error) {
    throw toTinybirdStepError(error);
  }
  return stepStatus(true, rows.length, jsonBytes(rows));
}
