import { NESO_HISTORIC_SOURCE } from "@/lib/historic-mix";
import type { HistoricPeriodView } from "@/lib/historic-mix";
import type { DashboardPeriod } from "@/lib/dashboard-period";
import type { LatestFacts } from "@/lib/facts";
import { getLondonDate } from "@/lib/london-time";

const NESO_DEFINITION =
  "Period average from NESO historic generation mix, including embedded wind and solar";

export function historicHeaderStamp(period: "year" | "all"): string {
  return period === "year"
    ? "Weekly averages from NESO historic mix"
    : "Monthly-scale averages from NESO historic mix since 2009";
}

export function buildHistoricFacts(
  view: HistoricPeriodView,
  period: Extract<DashboardPeriod, "year" | "all">,
  now = new Date()
): LatestFacts {
  const today = getLondonDate(now);
  const empty = view.averageRows.length === 0;
  const carbon = view.averages.carbon;

  return {
    empty,
    emptyState: empty
      ? {
          message: "NESO historic mix is still loading. Try Day or Week, or refresh later.",
          action: "Go to latest",
          href: "/",
        }
      : null,
    coverageStart: "2009-01-01",
    requestedDate: today,
    isHistorical: true,
    isStale: false,
    stamp: null,
    headerStamp: historicHeaderStamp(period),
    carbon: {
      value: carbon,
      unit: "gCO₂/kWh",
      periodStartUtc: null,
      periodEndUtc: null,
      source: NESO_HISTORIC_SOURCE,
      definition: NESO_DEFINITION,
      index: null,
    },
    demand: {
      value: view.averages.demandMw,
      unit: "MW",
      periodStartUtc: null,
      periodEndUtc: null,
      source: NESO_HISTORIC_SOURCE,
      definition: "NESO historic generation, treated as demand (generation plus imports and storage)",
    },
    price: {
      value: null,
      unit: "£/MWh",
      periodStartUtc: null,
      periodEndUtc: null,
      source: NESO_HISTORIC_SOURCE,
      definition: "Market prices are not published in the NESO historic mix",
    },
    systemPrice: {
      value: null,
      unit: "£/MWh",
      periodStartUtc: null,
      periodEndUtc: null,
      source: NESO_HISTORIC_SOURCE,
      definition: "System prices are not published in the NESO historic mix",
    },
    generationMw: {
      value: view.averages.generationMw,
      unit: "MW",
      periodStartUtc: null,
      periodEndUtc: null,
      source: NESO_HISTORIC_SOURCE,
      definition: NESO_DEFINITION,
    },
    netImportsMw: {
      value: view.averages.transfersMw,
      unit: "MW",
      periodStartUtc: null,
      periodEndUtc: null,
      source: NESO_HISTORIC_SOURCE,
      definition: "NESO historic mix publishes interconnector imports, not signed net transfers",
    },
    pumpedStorageMw: {
      value: null,
      unit: "MW",
      periodStartUtc: null,
      periodEndUtc: null,
      source: NESO_HISTORIC_SOURCE,
      definition: "Pumped storage net output in the NESO historic mix",
    },
    shares: [],
    generationRows: view.averageRows,
    mixSnapshot: view.snapshots.at(-1) ?? null,
    referenceTimestamp: null,
  };
}
