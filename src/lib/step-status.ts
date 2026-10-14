/** Stored on the workflow event log. The series itself stays in Redis. */
export type StepStatus = {
  ok: boolean;
  rows: number;
  bytes: number;
  cachedAt: number;
};

export function stepStatus(
  ok: boolean,
  rows: number,
  bytes = 0,
  cachedAt = Date.now()
): StepStatus {
  return { ok, rows, bytes, cachedAt };
}

export function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value));
}
