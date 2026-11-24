import type { DashboardPayload } from "@/lib/dashboard-payload-model";
import { homepageCiteFromPayload } from "@/lib/homepage-briefing";
import { CURRENT_PRICE_CAP, OFGEM_JAN_2027_ANNOUNCEMENT_LABEL } from "@/lib/price-cap";

export const LLMS_TXT_REVALIDATE_SECONDS = 3600;

export function buildLlmsTxt(payload: DashboardPayload | null, balancingLine?: string | null): string {
  const cite = homepageCiteFromPayload(payload);
  const cap = CURRENT_PRICE_CAP.typicalDualFuelDirectDebitGbp.toLocaleString("en-GB");
  const latest =
    cite.kind === "numbers"
      ? `Latest (GB, half-hour starting ${cite.timeLabel} on ${cite.dateLabel}): ${cite.topFuel.charAt(0).toLowerCase()}${cite.topFuel.slice(1)} supplied ${cite.topSharePct}% of generation (${cite.topGw} GW), gas ${cite.gasSharePct}%, carbon intensity ${cite.carbon} gCO2/kWh, market index £${cite.price}/MWh. Sources: Elexon BMRS, NESO, Carbon Intensity API, Sheffield Solar PV_Live.`
      : "Latest: Grid updates hourly from public data when the latest snapshot is in cache.";
  const sap = payload?.prices.find((row) => row.commodity === "gb_gas_sap");
  const sapLine = sap
    ? `Latest GB gas System Average Price: ${sap.price} ${sap.unit} for ${sap.date}. Source: National Gas.`
    : "Latest GB gas System Average Price is on https://grid.vahaah.com/prices/gas. Source: National Gas.";

  return `# Grid

> Grid is a free view of Great Britain's electricity and gas system, updated hourly from public data: Elexon BMRS, NESO, the NESO Carbon Intensity API and Sheffield Solar PV_Live for electricity; National Gas, the U.S. EIA and the World Bank for gas and oil. Made by Alex Vakhitov (https://vahaah.com). Every figure carries its source, time and unit. Grid's derived data is CC BY 4.0; upstream licences and attributions are on https://grid.vahaah.com/data-sources.

${latest}
${sapLine}
${balancingLine ?? "Latest GB balancing costs are on https://grid.vahaah.com/system/balancing. Source: NESO."}
Ofgem price cap: £${cap} a year (typical dual-fuel Direct Debit, ${CURRENT_PRICE_CAP.periodLabel}). Next cap announced ${OFGEM_JAN_2027_ANNOUNCEMENT_LABEL}.

## Answers
- [GB electricity today](https://grid.vahaah.com/today): today's generation mix, gas share, carbon intensity, demand, imports and market price, with a visible FAQ
- [What's powering electricity in Great Britain](https://grid.vahaah.com/): the latest half-hour, with day, week, year and all-time views
- [GB gas price today](https://grid.vahaah.com/prices/gas): GB System Average Price, Henry Hub, World Bank Europe gas and Japan LNG
- [Energy price cap January 2027: will bills go up?](https://grid.vahaah.com/explained/price-cap): Ofgem price caps as published, and what sets the next one
- [GB electricity records](https://grid.vahaah.com/records): records since Grid's records began, next to NESO's official records
- [GB gas system](https://grid.vahaah.com/gas): National Transmission System supply, demand, linepack and storage by gas day
- [GB grid balancing costs and BSUoS](https://grid.vahaah.com/system/balancing#summary): NESO daily balancing costs by category, the BSUoS tariff, a per-household estimate, and a separate estimate of electricity traded with neighbouring countries

## Data pages
- [Map](https://grid.vahaah.com/map): interconnector and gas entry-point flows, power stations, DNO licence areas
- [Storage](https://grid.vahaah.com/system/storage): battery and pumped-storage capacity, and what pumped storage is doing
- [Constraints](https://grid.vahaah.com/system/constraints): published transmission constraint cost and volume (NESO, published with a lag)
- [Balancing](https://grid.vahaah.com/system/balancing#summary): NESO daily balancing cost by category, the BSUoS tariff, and an estimate of electricity traded with neighbouring countries
- [Pipeline](https://grid.vahaah.com/pipeline): renewable and storage projects by stage, technology and nation (DESNZ REPD, quarterly)
- [Projects](https://grid.vahaah.com/projects): planning, construction and connection status from REPD and the NESO TEC register
- [Assets](https://grid.vahaah.com/assets): operational stations from REPD and DUKES
- [Whole energy](https://grid.vahaah.com/system/whole-energy): UK annual energy balance 2025 (DUKES 2026), not today's figures
- [Northern Ireland](https://grid.vahaah.com/electricity/northern-ireland): NI and all-island electricity, kept outside GB totals
- [Power cuts](https://grid.vahaah.com/power-cuts): power cuts reported by network operators in parts of England and Wales, updated every 15 minutes; Scotland and Northern Ireland are not covered yet
- [Changes](https://grid.vahaah.com/changes): changes found in published registers, with evidence
- [Directory](https://grid.vahaah.com/directory): who holds an MPID or industry code, by date
- [Tools](https://grid.vahaah.com/tools): official services by task (bills, network operators, power cuts, gas emergencies)

## Method and data
- [Methodology](https://grid.vahaah.com/methodology): sources, cadence, definitions, data checks, how records work
- [Data sources](https://grid.vahaah.com/data-sources): every source with its licence and required attribution
- [Data health](https://grid.vahaah.com/data-health): when each source published and when Grid fetched it
- [API](https://grid.vahaah.com/api): free JSON, no key, 60 requests a minute
- [Snapshots JSON, last 24 hours](https://grid.vahaah.com/api/snapshots?range=24h)

## How to cite
Grid (grid.vahaah.com), {page title}, data from {sources named on the page}, retrieved {D Mon YYYY, HH:MM} {BST|GMT}. Licence: CC BY 4.0 for Grid's derived data; upstream attributions apply.
`;
}
