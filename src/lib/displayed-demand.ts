import { isEmbeddedFuel, splitLatestGenerationRows } from "@/lib/dashboard-model";
import { alignAnswerPeriod } from "@/lib/generation-desk-view";
import type { LatestFacts } from "@/lib/facts";
import type { EnergySnapshot, Generation5min } from "@/lib/types";

export const DISPLAYED_DEMAND_STAT = "demand";

export type DisplayedPower = {
  demandMw: number | null;
  generationMw: number | null;
  transfersMw: number | null;
  transmissionDemandMw: number | null;
  demandSource: string;
  generationSource: string;
  transfersSource: string;
  demandDefinition: string;
  demandStartUtc: string | null;
  generationStartUtc: string | null;
  transfersStartUtc: string | null;
  generationRows: Generation5min[];
  alignmentNote: string | null;
};

export function getDisplayedPower(
  facts: LatestFacts,
  headlineSnapshots: EnergySnapshot[] = []
): DisplayedPower {
  const aligned = alignAnswerPeriod(facts, headlineSnapshots);
  return {
    demandMw: aligned.demand.value,
    generationMw: aligned.generationMw.value,
    transfersMw: aligned.netImportsMw.value,
    transmissionDemandMw: transmissionDemandFromAligned(
      aligned.demand.value,
      aligned.generationRows
    ),
    demandSource: aligned.demand.source,
    generationSource: aligned.generationMw.source,
    transfersSource: aligned.netImportsMw.source,
    demandDefinition: aligned.demand.definition,
    demandStartUtc: aligned.demand.periodStartUtc,
    generationStartUtc: aligned.generationMw.periodStartUtc,
    transfersStartUtc: aligned.netImportsMw.periodStartUtc,
    generationRows: aligned.generationRows,
    alignmentNote: aligned.alignmentNote,
  };
}

export const HEADLINE_BALANCE_TOLERANCE_MW = 250;

export function demandLabelsFrom(power: DisplayedPower): number[] {
  return [power.demandMw].filter((value): value is number => value != null);
}

export function headlineBalanceResidualMw(power: DisplayedPower): number | null {
  if (power.demandMw == null || power.generationMw == null || power.transfersMw == null) {
    return null;
  }
  return power.demandMw - (power.generationMw + power.transfersMw);
}

export function headlineBalanceHolds(power: DisplayedPower): boolean {
  const residual = headlineBalanceResidualMw(power);
  return residual != null && Math.abs(residual) <= HEADLINE_BALANCE_TOLERANCE_MW;
}

function transmissionDemandFromAligned(
  displayedDemandMw: number | null,
  generationRows: Generation5min[]
): number | null {
  if (displayedDemandMw == null) {
    return null;
  }

  let embeddedMw = 0;
  for (const row of splitLatestGenerationRows(generationRows).sources) {
    if (isEmbeddedFuel(row.fuel_type)) {
      embeddedMw += row.generation_mw;
    }
  }

  return displayedDemandMw - embeddedMw;
}
