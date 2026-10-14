import { createHash } from "node:crypto";

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortValue(record[key]);
    }
    return sorted;
  }
  return value;
}

/** Stable JSON for extract hashes. Release lines are compared as committed bytes, not this form. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function sha256Prefixed(value: unknown): string {
  const hex = createHash("sha256").update(canonicalJson(value)).digest("hex");
  return `sha256:${hex}`;
}

/** Hash of the downloaded extract bytes, stored inside a release `content` object. */
export function sha256Bytes(bytes: Uint8Array): string {
  const hex = createHash("sha256").update(bytes).digest("hex");
  return `sha256:${hex}`;
}
