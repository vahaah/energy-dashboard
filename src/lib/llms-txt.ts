import { homepageCiteFromPayload } from "@/lib/homepage-briefing";
import type { DashboardPayload } from "@/lib/dashboard-payload-model";

export const LLMS_TXT_REVALIDATE_SECONDS = 3600;

export function buildLlmsTxt(payload: DashboardPayload | null): string {
  const cite = homepageCiteFromPayload(payload);
  const latest =
    cite.kind === "numbers"
      ? `Latest: At ${cite.timeLabel} on ${cite.dateLabel}, ${cite.topFuel.toLowerCase()} supplied ${cite.topSharePct}% of GB electricity, gas ${cite.gasSharePct}%, carbon intensity ${cite.carbon} gCO2/kWh. Source: Elexon BMRS, NESO.`
      : "Latest: Grid updates hourly from public data when the latest snapshot is in cache.";

  return `# Grid

> Grid is a free view of Great Britain's electricity system, updated hourly from public data (Elexon BMRS, NESO, Carbon Intensity API, Sheffield Solar PV Live; gas and oil from National Gas, World Bank and EIA). Made by Alex Vakhitov (https://vahaah.com). Every number carries its source, time and unit. Derived data: CC BY 4.0 with upstream attributions.

${latest}

## Pages
- [Today](https://grid.vahaah.com/today): today's GB generation mix, carbon intensity, demand, prices
- [Records](https://grid.vahaah.com/records): records since Grid's records began, beside NESO official records
- [UK gas price](https://grid.vahaah.com/prices/gas): GB System Average Price, Henry Hub, World Bank Europe gas and Japan LNG
- [Price cap explained](https://grid.vahaah.com/explained/price-cap): January 2027 price cap, announced by 25 Nov 2026
- [Methodology](https://grid.vahaah.com/methodology): sources, licences, definitions, data checks

## Data
- [API docs](https://grid.vahaah.com/api): JSON, no key, 60 requests/minute
- [Snapshots JSON](https://grid.vahaah.com/api/snapshots?range=24h)

## How to cite
"Grid (grid.vahaah.com), data from Elexon BMRS and NESO, {date time}."
`;
}
