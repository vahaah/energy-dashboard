import { loadAssetCatalogue } from "@/lib/assets/load";
import { gasStore, mutablePut } from "@/lib/gas/blob";
import { MAP_STATIONS_LATEST } from "@/lib/map/flows-release";
import { stationsFromPoints } from "@/lib/map/stations-layer";

/** Once a UTC day. The map fetches this file only after the stations layer is switched on. */
export async function publishMapStationsIfDue(now: Date): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return;
  }
  const existing = await gasStore().get(MAP_STATIONS_LATEST, true);
  if (existing) {
    try {
      const parsed = JSON.parse(existing.body) as { generated_at?: string };
      if (parsed.generated_at?.slice(0, 10) === now.toISOString().slice(0, 10)) {
        return;
      }
    } catch {
      // Rewrite a body that is not the station collection.
    }
  }
  const body = stationsFromPoints(loadAssetCatalogue().points, now);
  await gasStore().put(MAP_STATIONS_LATEST, `${JSON.stringify(body)}\n`, mutablePut("application/json"));
}
