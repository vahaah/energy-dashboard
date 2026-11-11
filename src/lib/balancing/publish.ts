import { readFixtureRelease } from "@/lib/balancing/load";
import {
  BALANCING_LATEST_PATH,
  BALANCING_PREVIOUS_PATH,
  balancingReleaseId,
  balancingReleasePath,
  balancingStore,
  immutablePut,
  mutablePut,
  parseBalancingPointer,
} from "@/lib/balancing/blob";
import { applyWindow, emptyRelease } from "@/lib/balancing/build";
import type { DailyWindow } from "@/lib/balancing/fetch";
import { revalidateBalancingPaths } from "@/lib/balancing/revalidate";
import type { BalancingRelease } from "@/lib/balancing/types";

export async function readBaseRelease(now: Date): Promise<BalancingRelease> {
  const stored = await balancingStore().get(BALANCING_LATEST_PATH, false);
  const pointer = stored ? parseBalancingPointer(stored.body) : null;
  if (pointer) {
    const body = await balancingStore().get(balancingReleasePath(pointer.release_id), false);
    if (body) {
      const parsed = JSON.parse(body.body) as BalancingRelease;
      if (parsed.schema_version === 1 && Array.isArray(parsed.trade_days)) {
        return parsed;
      }
    }
  }
  return readFixtureRelease() ?? emptyRelease(now);
}

export async function publishMergedWindow(window: DailyWindow, now: Date): Promise<{ releaseId: string; rows: number }> {
  const base = await readBaseRelease(now);
  const release = applyWindow(base, window, now);
  const body = `${JSON.stringify(release)}\n`;
  const releaseId = balancingReleaseId(body);
  const path = balancingReleasePath(releaseId);
  const existing = await balancingStore().get(path, false);
  if (!existing) {
    await balancingStore().put(path, body, immutablePut("application/json"));
  }
  const current = await balancingStore().get(BALANCING_LATEST_PATH, false);
  const pointer = current ? parseBalancingPointer(current.body) : null;
  if (pointer && pointer.release_id !== releaseId) {
    await balancingStore().put(BALANCING_PREVIOUS_PATH, `${JSON.stringify(pointer)}\n`, mutablePut("application/json"));
  }
  if (pointer?.release_id !== releaseId) {
    await balancingStore().put(
      BALANCING_LATEST_PATH,
      `${JSON.stringify({ release_id: releaseId, generated_at: release.generated_at })}\n`,
      mutablePut("application/json"),
    );
  }
  revalidateBalancingPaths();
  return { releaseId, rows: release.days.length };
}
