import {
  CARBON_INTENSITY_API_URL,
  CARBON_INTENSITY_ATTRIBUTION,
  CARBON_INTENSITY_FORECAST_NOTE,
  CARBON_INTENSITY_LICENCE_URL,
  ELEXON_BMRS_LICENCE_URL,
  NESO_OPEN_DATA_ATTRIBUTION,
  NESO_OPEN_DATA_LICENCE_URL,
  PV_LIVE_ATTRIBUTION,
  PV_LIVE_URL,
  elexonBmrsAttribution,
} from "@/lib/attribution";
import { fuelLabel } from "@/lib/colors";
import { hydrateDashboardPayload, type DashboardPayload } from "@/lib/dashboard-payload-model";
import { getDisplayedPower } from "@/lib/displayed-demand";
import { formatHeadlineGw } from "@/lib/facts";
import { generationMixShares } from "@/lib/generation-share";
import { buildHomepageCite, homepageCitePlainText } from "@/lib/homepage-briefing";
import {
  formatLondonCiteDate,
  formatLondonClock,
  formatLondonIsoOffset,
  parseUtcDateTime,
} from "@/lib/london-time";
import type { SourceCredit } from "@/lib/webmcp/result";

export type MixFuel = {
  fuel: string;
  label: string;
  mw: number;
  /** Gigawatts as shown on the page, one decimal place. */
  gw: string;
  /** Displayed percent of generation. The fuels sum to 100. */
  shareOfGenerationPct: number;
};

export type GreenestWindowReading = {
  startUtc: string;
  endUtc: string;
  gramsPerKwh: number;
  sentence: string;
  fetchedAt: string | null;
  note: string;
};

export type GridLiveReading = {
  pageSentence: string | null;
  stale: boolean;
  settlementStart: string | null;
  settlementStartUtc: string | null;
  settlementTimeLabel: string | null;
  settlementDateLabel: string | null;
  topFuel: string | null;
  topGw: string | null;
  topShareOfGenerationPct: number | null;
  gasShareOfGenerationPct: number | null;
  demandMw: number | null;
  demandGw: string | null;
  generationMw: number | null;
  generationGw: string | null;
  fuels: MixFuel[];
  carbon: {
    gramsPerKwh: number;
    unit: "gCO₂/kWh";
    index: string | null;
    periodStartUtc: string | null;
    periodEndUtc: string | null;
    source: string;
  } | null;
  marketIndex: {
    gbpPerMwh: number;
    unit: "£/MWh";
    series: "Market Index (APXMIDP)";
    periodStartUtc: string | null;
    periodEndUtc: string | null;
    source: string;
  } | null;
  imbalance: {
    gbpPerMwh: number | null;
    unit: "£/MWh";
    series: "System (imbalance) price";
    periodStartUtc: string | null;
    periodEndUtc: string | null;
    source: string;
  };
  greenest: GreenestWindowReading | null;
  sources: SourceCredit[];
};

export function electricitySources(year: number): SourceCredit[] {
  return [
    {
      name: "Elexon BMRS",
      attribution: elexonBmrsAttribution(year),
      url: ELEXON_BMRS_LICENCE_URL,
    },
    {
      name: "NESO",
      attribution: NESO_OPEN_DATA_ATTRIBUTION,
      url: NESO_OPEN_DATA_LICENCE_URL,
    },
    {
      name: "Carbon Intensity API",
      attribution: CARBON_INTENSITY_ATTRIBUTION,
      url: CARBON_INTENSITY_API_URL,
      licence: CARBON_INTENSITY_LICENCE_URL,
    },
    {
      name: "Sheffield Solar PV_Live",
      attribution: PV_LIVE_ATTRIBUTION,
      url: PV_LIVE_URL,
    },
  ];
}

function creditYear(generatedAt: string): number {
  const year = Number(generatedAt.slice(0, 4));
  return Number.isInteger(year) && year >= 2000 ? year : new Date().getUTCFullYear();
}

function gwOrNull(mw: number | null): string | null {
  if (mw == null) {
    return null;
  }
  return formatHeadlineGw(mw);
}

/**
 * Figures already on the dashboard payload.
 * A missing carbon reading does not drop the mix or the wholesale price, and the reverse.
 * A historical payload is refused so a dated dashboard body cannot be treated as current.
 * The raw carbon forecast series is not copied.
 */
export function liveReadingFromPayload(payload: DashboardPayload | null, generatedAt: string): GridLiveReading | null {
  if (!payload || payload.facts.isHistorical) {
    return null;
  }
  const hydrated = hydrateDashboardPayload(payload);
  const facts = hydrated.facts;
  const power = getDisplayedPower(facts, hydrated.headlineSnapshots);
  const shares = generationMixShares(facts.generationRows, power.generationStartUtc);
  const cite = buildHomepageCite({
    facts,
    headlineSnapshots: hydrated.headlineSnapshots,
  });
  const top = shares[0] ?? null;
  const gas = shares.find((share) => share.fuel === "gas");
  const window = hydrated.lookAhead?.greenestWindow ?? null;
  const carbon = facts.carbon.value;
  const market = facts.price.value;
  const imbalance = facts.systemPrice.value;
  const hasMix = shares.length > 0 || power.demandMw != null || power.generationMw != null;
  if (!hasMix && carbon == null && market == null && imbalance == null && !window) {
    return null;
  }
  const startUtc = power.generationStartUtc ?? facts.carbon.periodStartUtc ?? facts.price.periodStartUtc ?? facts.systemPrice.periodStartUtc;
  const at = startUtc ? parseUtcDateTime(startUtc) : null;
  return {
    pageSentence: cite.kind === "numbers" ? homepageCitePlainText(cite) : null,
    stale: facts.isStale,
    settlementStart: at ? formatLondonIsoOffset(at) : null,
    settlementStartUtc: startUtc,
    settlementTimeLabel: at ? formatLondonClock(at) : null,
    settlementDateLabel: at ? formatLondonCiteDate(at) : null,
    topFuel: top ? fuelLabel(top.fuel) : null,
    topGw: top ? formatHeadlineGw(top.mw) : null,
    topShareOfGenerationPct: top ? top.displayPct : null,
    gasShareOfGenerationPct: gas ? gas.displayPct : null,
    demandMw: power.demandMw,
    demandGw: gwOrNull(power.demandMw),
    generationMw: power.generationMw,
    generationGw: gwOrNull(power.generationMw),
    fuels: shares.map((share) => ({
      fuel: share.fuel,
      label: share.label,
      mw: share.mw,
      gw: formatHeadlineGw(share.mw),
      shareOfGenerationPct: share.displayPct,
    })),
    carbon:
      carbon == null
        ? null
        : {
            gramsPerKwh: carbon,
            unit: "gCO₂/kWh",
            index: facts.carbon.index,
            periodStartUtc: facts.carbon.periodStartUtc,
            periodEndUtc: facts.carbon.periodEndUtc,
            source: facts.carbon.source,
          },
    marketIndex:
      market == null
        ? null
        : {
            gbpPerMwh: market,
            unit: "£/MWh",
            series: "Market Index (APXMIDP)",
            periodStartUtc: facts.price.periodStartUtc,
            periodEndUtc: facts.price.periodEndUtc,
            source: facts.price.source,
          },
    imbalance: {
      gbpPerMwh: facts.systemPrice.value,
      unit: "£/MWh",
      series: "System (imbalance) price",
      periodStartUtc: facts.systemPrice.periodStartUtc,
      periodEndUtc: facts.systemPrice.periodEndUtc,
      source: facts.systemPrice.source,
    },
    greenest: window
      ? {
          startUtc: window.startUtc,
          endUtc: window.endUtc,
          gramsPerKwh: window.grams,
          sentence: window.sentence,
          fetchedAt: hydrated.lookAhead?.fetchedAt ?? null,
          note: CARBON_INTENSITY_FORECAST_NOTE,
        }
      : null,
    sources: electricitySources(creditYear(generatedAt)),
  };
}

export function isDashboardPayload(value: unknown): value is DashboardPayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const facts = (value as { facts?: unknown }).facts;
  if (!facts || typeof facts !== "object") {
    return false;
  }
  return "carbon" in facts && "price" in facts && "generationRows" in facts;
}

export function greenestFromLookAhead(body: unknown): GreenestWindowReading | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const fetchedAt = (body as { fetchedAt?: unknown }).fetchedAt;
  const window = (body as { greenestWindow?: unknown }).greenestWindow;
  if (!window || typeof window !== "object") {
    return null;
  }
  const startUtc = (window as { startUtc?: unknown }).startUtc;
  const endUtc = (window as { endUtc?: unknown }).endUtc;
  const grams = (window as { grams?: unknown }).grams;
  const sentence = (window as { sentence?: unknown }).sentence;
  if (
    typeof startUtc !== "string" ||
    typeof endUtc !== "string" ||
    typeof grams !== "number" ||
    !Number.isFinite(grams) ||
    typeof sentence !== "string"
  ) {
    return null;
  }
  return {
    startUtc,
    endUtc,
    gramsPerKwh: grams,
    sentence,
    fetchedAt: typeof fetchedAt === "string" ? fetchedAt : null,
    note: CARBON_INTENSITY_FORECAST_NOTE,
  };
}
