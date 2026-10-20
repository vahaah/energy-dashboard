import { NextResponse } from "next/server";
import { loadAssetCatalogue } from "@/lib/assets/load";
import { gasStore } from "@/lib/gas/blob";
import { MAP_STATIONS_LATEST } from "@/lib/map/flows-release";
import { stationsFromPoints, type StationFeatureCollection } from "@/lib/map/stations-layer";

export const dynamic = "force-dynamic";

const CACHE_CONTROL = "public, max-age=3600, stale-while-revalidate=86400";

function isStationCollection(value: unknown): value is StationFeatureCollection {
  return Boolean(value) && typeof value === "object" && (value as StationFeatureCollection).type === "FeatureCollection";
}

async function readStationsBlob(): Promise<StationFeatureCollection | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return null;
  }
  const stored = await gasStore().get(MAP_STATIONS_LATEST, true);
  if (!stored) {
    return null;
  }
  try {
    const parsed = JSON.parse(stored.body) as unknown;
    return isStationCollection(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * GET /api/v1/map/stations
 *
 * On-demand station points. Blob when a release is published, otherwise the
 * checked-in register. Not embedded in `/map`. No Tinybird query.
 */
export async function GET() {
  const fromBlob = await readStationsBlob().catch(() => null);
  const body = fromBlob ?? stationsFromPoints(loadAssetCatalogue().rows);
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": CACHE_CONTROL,
      "CDN-Cache-Control": CACHE_CONTROL,
    },
  });
}
