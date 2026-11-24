import { formatHeadlineGw } from "@/lib/facts";
import type { GridRecords } from "@/lib/historic-mix";

export function recordsStandfirst(records: GridRecords): string {
  const wind = records.maxWind ? `${formatHeadlineGw(records.maxWind.value)} GW` : "not published";
  const renewable = records.highestRenewableShare
    ? `${records.highestRenewableShare.value.toFixed(1)}%`
    : "not published";
  const carbon = records.lowestCarbon ? `${records.lowestCarbon.value.toFixed(0)} gCO₂/kWh` : "not published";
  const days = records.daysSinceCoal == null ? "not published" : `${records.daysSinceCoal} days`;
  return `Highest wind ${wind}, highest renewable share ${renewable}, lowest carbon ${carbon}, ${days} since coal. Shown next to NESO's official records.`;
}
