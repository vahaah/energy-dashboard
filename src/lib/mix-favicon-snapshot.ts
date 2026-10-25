import { FUEL_COLORS } from "@/lib/colors";
import { getHeadlineSnapshotsQueryParams } from "@/lib/dashboard-data";
import { latestSnapshotWithMix } from "@/lib/dashboard-model";
import {
  dashboardPayloadCacheKey,
  dashboardPayloadPolicy,
  type DashboardPayload,
} from "@/lib/dashboard-payload-model";
import { generationMixShares } from "@/lib/generation-share";
import {
  mixSegmentsFromSnapshot,
  type MixFaviconSegment,
} from "@/lib/mix-favicon";
import { peekThroughCache } from "@/lib/redis-cache";
import type { EnergySnapshot } from "@/lib/types";
import { peekWarmedPipe } from "@/lib/warm-envelope";

/**
 * Redis reads only. A hung Upstash call must not pin the icon render.
 * The homepage payload is the longer-lived copy of the same mix.
 */
export const MIX_FAVICON_READ_TIMEOUT_MS = 2_000;

let lastGoodMix: MixFaviconSegment[] | null = null;

export function resetMixFaviconSnapshotForTests(): void {
  lastGoodMix = null;
}

/**
 * Current GB generation mix from caches that already exist.
 * Never calls Tinybird. A miss keeps the last mix this process drew.
 */
export async function loadMixFaviconSegments(now = new Date()): Promise<MixFaviconSegment[]> {
  const [payload, warmed] = await Promise.all([
    readOrNull(peekHomepagePayload()),
    readOrNull(
      peekWarmedPipe<EnergySnapshot>("snapshots_range", getHeadlineSnapshotsQueryParams(now), {
        range: "24h",
        now,
      })
    ),
  ]);

  const segments =
    segmentsFromPayload(payload) ??
    nonempty(mixSegmentsFromSnapshot(latestSnapshotWithMix(warmed ?? [])));

  if (segments) {
    lastGoodMix = segments;
    return segments;
  }
  return lastGoodMix ?? [];
}

function segmentsFromPayload(payload: DashboardPayload | null): MixFaviconSegment[] | null {
  if (!payload) {
    return null;
  }

  const fromSnapshot =
    nonempty(mixSegmentsFromSnapshot(payload.facts.mixSnapshot)) ??
    nonempty(
      mixSegmentsFromSnapshot(
        latestSnapshotWithMix([...payload.headlineSnapshots, ...payload.snapshots])
      )
    );
  if (fromSnapshot) {
    return fromSnapshot;
  }

  const shares = generationMixShares(
    payload.facts.generationRows,
    payload.facts.generationMw.periodStartUtc
  );
  const fromGeneration = shares
    .filter((share) => share.mw > 0)
    .map((share) => ({
      fuel: share.fuel,
      pct: share.sharePct,
      color: FUEL_COLORS[share.fuel] ?? FUEL_COLORS.other ?? "#737373",
    }));
  return nonempty(fromGeneration);
}

async function peekHomepagePayload(): Promise<DashboardPayload | null> {
  return peekThroughCache<DashboardPayload>(
    dashboardPayloadCacheKey("day", null),
    dashboardPayloadPolicy("day")
  );
}

function nonempty(segments: MixFaviconSegment[] | null): MixFaviconSegment[] | null {
  if (!segments || segments.length === 0) {
    return null;
  }
  return segments;
}

async function readOrNull<T>(work: Promise<T | null>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work.catch(() => null),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), MIX_FAVICON_READ_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
