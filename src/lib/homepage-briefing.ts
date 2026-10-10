import { fuelLabel } from "@/lib/colors";
import {
  generationSharesFromRows,
  normalizeFuelType,
  type GenerationShare,
} from "@/lib/dashboard-model";
import {
  hydrateDashboardPayload,
  type DashboardPayload,
} from "@/lib/dashboard-payload-model";
import { getDisplayedPower } from "@/lib/displayed-demand";
import { formatHeadlineGw, type LatestFacts } from "@/lib/facts";
import {
  formatLondonCiteDate,
  formatLondonClock,
  formatLondonIsoOffset,
  parseUtcDateTime,
} from "@/lib/london-time";
import { HOME_H1 } from "@/lib/site";
import type { EnergySnapshot } from "@/lib/types";

export { HOME_H1 };

export const HOME_CITE_FALLBACK =
  "Britain's electricity mix, carbon intensity, demand and prices, updated hourly from Elexon, NESO and Sheffield Solar. Sources: Elexon BMRS, NESO. Grid is free and updated hourly from public data.";

export type HomepageCite =
  | {
      kind: "numbers";
      datetime: string;
      timeLabel: string;
      dateLabel: string;
      topFuel: string;
      topGw: string;
      topSharePct: string;
      gasSharePct: string;
      carbon: string;
      price: string;
      demandGw: string;
      generationGw: string;
    }
  | {
      kind: "fallback";
    };

export function homepageCiteFromPayload(payload: DashboardPayload | null): HomepageCite {
  if (!payload) {
    return { kind: "fallback" };
  }

  const hydrated = hydrateDashboardPayload(payload);
  return buildHomepageCite({
    facts: hydrated.facts,
    headlineSnapshots: hydrated.headlineSnapshots,
  });
}

export function buildHomepageCite(input: {
  facts: LatestFacts;
  headlineSnapshots?: EnergySnapshot[];
}): HomepageCite {
  const power = getDisplayedPower(input.facts, input.headlineSnapshots ?? []);
  const shareSource =
    input.facts.shares.length > 0
      ? input.facts.shares
      : generationSharesFromRows(power.generationRows);
  const shares = citeFuelShares(shareSource);
  const top = [...shares].sort((left, right) => right.mw - left.mw)[0];
  const gas = shares.find((share) => share.fuel === "gas");
  const timestamp = input.facts.referenceTimestamp;
  const carbon = input.facts.carbon.value;
  const price = input.facts.price.value;

  if (!timestamp || !top || carbon == null || price == null) {
    return { kind: "fallback" };
  }

  const at = parseUtcDateTime(timestamp);
  return {
    kind: "numbers",
    datetime: formatLondonIsoOffset(at),
    timeLabel: formatLondonClock(at),
    dateLabel: formatLondonCiteDate(at),
    topFuel: fuelLabel(top.fuel),
    topGw: formatHeadlineGw(top.mw),
    topSharePct: Math.round(top.sharePct).toFixed(0),
    gasSharePct: Math.round(gas?.sharePct ?? 0).toFixed(0),
    carbon: carbon.toFixed(0),
    price: price.toFixed(2),
    demandGw: formatHeadlineGw(power.demandMw),
    generationGw: formatHeadlineGw(power.generationMw),
  };
}

export function homepageCitePlainText(cite: HomepageCite): string {
  switch (cite.kind) {
    case "fallback":
      return HOME_CITE_FALLBACK;
    case "numbers":
      return `At ${cite.timeLabel} on ${cite.dateLabel}, ${cite.topFuel} was Britain's largest source of electricity at ${cite.topGw} GW (${cite.topSharePct}%). Gas supplied ${cite.gasSharePct}%, and carbon intensity was ${cite.carbon} gCO₂/kWh. The market index price was £${cite.price}/MWh. Sources: Elexon BMRS, NESO. Grid is free and updated hourly from public data.`;
    default: {
      const exhaustive: never = cite;
      return exhaustive;
    }
  }
}

function citeFuelShares(shares: GenerationShare[]): GenerationShare[] {
  const grouped = new Map<string, number>();
  for (const share of shares) {
    const fuel = citeFuelKey(share.fuel);
    grouped.set(fuel, (grouped.get(fuel) ?? 0) + share.mw);
  }

  const total = [...grouped.values()].reduce((sum, mw) => sum + mw, 0);
  if (total === 0) {
    return [];
  }

  return [...grouped.entries()].map(([fuel, mw]) => ({
    fuel,
    mw,
    sharePct: (mw / total) * 100,
  }));
}

function citeFuelKey(fuel: string): string {
  const normalized = normalizeFuelType(fuel);
  switch (normalized) {
    case "embedded_wind":
      return "wind";
    case "embedded_solar":
      return "solar";
    default:
      return normalized;
  }
}
