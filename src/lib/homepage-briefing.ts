import { fuelLabel } from "@/lib/colors";
import { generationMixShares } from "@/lib/generation-share";
import {
  hydrateDashboardPayload,
  type DashboardPayload,
} from "@/lib/dashboard-payload-model";
import { getDisplayedPower } from "@/lib/displayed-demand";
import { formatHeadlineGw, type LatestFacts } from "@/lib/facts";
import {
  formatLondonCiteDate,
  formatLondonClock,
  formatLondonDayMonthYear,
  formatLondonIsoOffset,
  parseUtcDateTime,
} from "@/lib/london-time";
import { HOME_H1 } from "@/lib/site";
import type { EnergySnapshot } from "@/lib/types";

export { HOME_H1 };

export function historicalHomepageH1(date: string): string {
  return `What powered Britain's electricity on ${formatLondonDayMonthYear(date)}`;
}

export const HOME_CITE_SOURCES =
  "Sources: Elexon BMRS, NESO, Carbon Intensity API, Sheffield Solar PV Live.";

export const HOME_CITE_FALLBACK = `Britain's electricity mix, carbon intensity, demand and prices, updated hourly from Elexon, NESO and Sheffield Solar. ${HOME_CITE_SOURCES} Grid is free and updated hourly from public data.`;

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
  const shares = generationMixShares(input.facts.generationRows, power.generationStartUtc);
  const top = [...shares].sort((left, right) => right.mw - left.mw)[0];
  const gas = shares.find((share) => share.fuel === "gas");
  const timestamp = power.generationStartUtc ?? input.facts.generationMw.periodStartUtc;
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
      return `At ${cite.timeLabel} on ${cite.dateLabel}, ${cite.topFuel} was Britain's largest source of electricity at ${cite.topGw} GW (${cite.topSharePct}%). Gas supplied ${cite.gasSharePct}%, and carbon intensity was ${cite.carbon} gCO₂/kWh. The market index price was £${cite.price}/MWh. ${HOME_CITE_SOURCES} Grid is free and updated hourly from public data.`;
    default: {
      const exhaustive: never = cite;
      return exhaustive;
    }
  }
}

