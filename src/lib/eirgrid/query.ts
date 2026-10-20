import { combineOperationalGeographies, resolveOperationalGeography } from "@/lib/eirgrid/geography";
import type { NiRelease, NiSeries } from "@/lib/eirgrid/release";

export type NiQuery =
  | { status: 200; body: { geography_id: string; series: NiSeries[] } }
  | { status: 400; body: { error: "unsupported_dimension" } };

export function queryNorthernIreland(release: NiRelease | null, geography: string): NiQuery {
  const requested = geography.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
  if (requested.length !== 1) {
    const combined = combineOperationalGeographies(requested);
    if (!combined.ok) {
      return { status: 400, body: { error: "unsupported_dimension" } };
    }
  }
  const resolved = resolveOperationalGeography(requested[0] ?? geography);
  if (!resolved.ok) {
    return { status: 400, body: { error: "unsupported_dimension" } };
  }
  const series = (release?.series ?? []).filter((row) => row.geography_id === resolved.geography_id);
  return { status: 200, body: { geography_id: resolved.geography_id, series } };
}
