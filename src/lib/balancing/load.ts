import { readFileSync } from "node:fs";
import { join } from "node:path";
import { blobReadOrNull } from "@/lib/blob-read";
import { BALANCING_LATEST_PATH, balancingReleasePath, balancingStore, parseBalancingPointer } from "@/lib/balancing/blob";
import type { BalancingRelease } from "@/lib/balancing/types";

function parseRelease(value: unknown): BalancingRelease | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const release = value as BalancingRelease;
  if (release.schema_version !== 1 || !Array.isArray(release.days) || !Array.isArray(release.tariffs)) {
    return null;
  }
  if (!Array.isArray(release.trade_months) || !Array.isArray(release.trade_days)) {
    return null;
  }
  return release;
}

export function readFixtureRelease(): BalancingRelease | null {
  try {
    const text = readFileSync(join(process.cwd(), "tests/fixtures/balancing/release.json"), "utf8");
    return parseRelease(JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

async function readBlobRelease(): Promise<BalancingRelease | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return null;
  }
  const pointerText = await blobReadOrNull(async () => {
    const stored = await balancingStore().get(BALANCING_LATEST_PATH, true);
    return stored?.body ?? null;
  });
  if (!pointerText) {
    return null;
  }
  const pointer = parseBalancingPointer(pointerText);
  if (!pointer) {
    return null;
  }
  const body = await blobReadOrNull(async () => {
    const stored = await balancingStore().get(balancingReleasePath(pointer.release_id), true);
    return stored?.body ?? null;
  });
  if (!body) {
    return null;
  }
  return parseRelease(JSON.parse(body) as unknown);
}

/**
 * Blob when a pointer exists. The checked-in fixture covers CI, local builds,
 * and a deploy that has not published yet. No Tinybird call.
 */
export async function readBalancingRelease(): Promise<BalancingRelease | null> {
  if (process.env.VITEST === "true" || !process.env.BLOB_READ_WRITE_TOKEN) {
    return readFixtureRelease();
  }
  const published = await readBlobRelease();
  return published ?? readFixtureRelease();
}
