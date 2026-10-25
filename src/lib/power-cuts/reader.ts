import { unstable_cache } from "next/cache";
import { parseSnapshot, powerCutsStore, POWER_CUTS_LATEST_PATH } from "@/lib/power-cuts/blob";
import { buildFixtureSnapshot } from "@/lib/power-cuts/fixture";
import { POWER_CUTS_CACHE_TAG, powerCutsSnapshotSchema, type PowerCutsSnapshot } from "@/lib/power-cuts/schema";

export function readPowerCutsFixture(cwd = process.cwd()): PowerCutsSnapshot | null {
  try {
    return powerCutsSnapshotSchema.parse(buildFixtureSnapshot(cwd));
  } catch {
    return null;
  }
}

/** Blob when the token is set. Tests, CI, and local builds read the fixture and do not call Blob. */
export async function loadPowerCutsSnapshot(): Promise<PowerCutsSnapshot | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return readPowerCutsFixture();
  }
  try {
    const body = await powerCutsStore().get(POWER_CUTS_LATEST_PATH, true);
    if (!body) {
      return null;
    }
    return parseSnapshot(body);
  } catch (error) {
    console.error("[power-cuts] blob read failed", error instanceof Error ? error.name : "error");
    return null;
  }
}

export const readCachedPowerCuts = unstable_cache(loadPowerCutsSnapshot, ["power-cuts-snapshot"], {
  tags: [POWER_CUTS_CACHE_TAG],
  revalidate: 300,
});
