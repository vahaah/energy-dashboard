import { isEmbeddedFuel, splitLatestGenerationRows } from "@/lib/dashboard-model";
import { formatHeadlineGw, type LatestFacts } from "@/lib/facts";
import { alignAnswerPeriod } from "@/lib/generation-desk-view";
import {
  buildSettlementBalance,
  headlineGw,
  headlineTermsClose,
  type StorageChargingKind,
} from "@/lib/headline-balance";
import { parseUtcDateTime } from "@/lib/london-time";
import { getSettlementPeriod } from "@/lib/settlement-period";
import type { EnergySnapshot, Generation5min } from "@/lib/types";

export const DISPLAYED_DEMAND_STAT = "demand";

export type HeadlineTermId = "generation" | "imports" | "exports" | "storage_charging" | "demand";

export type HeadlineOperator = "+" | "−" | "=";

export type HeadlineTerm = {
  id: HeadlineTermId;
  label: string;
  mw: number | null;
  operator: HeadlineOperator | null;
  help: string;
  source: string;
};

export type DisplayedPower = {
  demandMw: number | null;
  generationMw: number | null;
  transfersMw: number | null;
  importsMw: number | null;
  exportsMw: number | null;
  storageChargingMw: number | null;
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
  balanceClosed: boolean;
  showEquals: boolean;
  terms: HeadlineTerm[];
};

export function getDisplayedPower(
  facts: LatestFacts,
  headlineSnapshots: EnergySnapshot[] = []
): DisplayedPower {
  const aligned = alignAnswerPeriod(facts, headlineSnapshots);
  const periodStartUtc = aligned.generationMw.periodStartUtc;
  const balance = buildSettlementBalance(facts.generationRows, periodStartUtc);
  const itsdo = itsdoMw(facts, headlineSnapshots, balance.bookComplete ? balance.periodStartUtc : periodStartUtc);
  const closed = balance.bookComplete && balance.hasSupply;
  const generationMw = balance.hasSupply ? balance.generationMw : aligned.generationMw.value;
  const demandMw = closed ? balance.demandMw : aligned.demand.value;
  const transfersMw = closed ? balance.netTransfersMw : aligned.netImportsMw.value;
  const generationSource = balance.hasSupply
    ? generationSourceFrom(balance.fuels.map((fuel) => fuel.fuel))
    : aligned.generationMw.source;
  const demandSource = closed ? generationSource : aligned.demand.source;
  const demandDefinition = closed
    ? demandDefinitionFrom(itsdo, balance.embeddedMw, balance.demandMw)
    : aligned.demand.definition;
  const showEquals =
    closed &&
    demandMw != null &&
    generationMw != null &&
    headlineTermsClose({
      generationMw,
      importsMw: balance.importsMw,
      exportsMw: balance.exportsMw,
      storageChargingMw: balance.storageChargingMw,
      demandMw,
    });
  const periodStart = closed ? balance.periodStartUtc : null;

  const power: DisplayedPower = {
    demandMw,
    generationMw,
    transfersMw,
    importsMw: closed ? balance.importsMw : null,
    exportsMw: closed ? balance.exportsMw : null,
    storageChargingMw: closed ? balance.storageChargingMw : null,
    transmissionDemandMw:
      itsdo ?? transmissionDemandFromAligned(aligned.demand.value, aligned.generationRows),
    demandSource,
    generationSource,
    transfersSource: aligned.netImportsMw.source,
    demandDefinition,
    demandStartUtc: closed ? periodStart : aligned.demand.periodStartUtc,
    generationStartUtc: closed ? periodStart : aligned.generationMw.periodStartUtc,
    transfersStartUtc: closed ? periodStart : aligned.netImportsMw.periodStartUtc,
    generationRows: closed && balance.rows.length > 0 ? balance.rows : aligned.generationRows,
    alignmentNote: aligned.alignmentNote,
    balanceClosed: closed,
    showEquals,
    terms: [],
  };
  power.terms = headlineTerms(power, balance.storageKind);
  return power;
}

export function demandLabelsFrom(power: DisplayedPower): number[] {
  return [power.demandMw].filter((value): value is number => value != null);
}

export function headlineBalanceResidualMw(power: DisplayedPower): number | null {
  if (
    !power.balanceClosed ||
    power.demandMw == null ||
    power.generationMw == null ||
    power.importsMw == null ||
    power.exportsMw == null ||
    power.storageChargingMw == null
  ) {
    return null;
  }
  return (
    power.demandMw -
    (power.generationMw + power.importsMw - power.exportsMw - power.storageChargingMw)
  );
}

export function headlineBalanceHolds(power: DisplayedPower): boolean {
  const residual = headlineBalanceResidualMw(power);
  return residual != null && Math.abs(residual) < 1e-6;
}

function headlineTerms(
  power: DisplayedPower,
  storageKind: StorageChargingKind | null
): HeadlineTerm[] {
  if (!power.balanceClosed) {
    return openTerms(power);
  }

  const terms: HeadlineTerm[] = [
    {
      id: "generation",
      label: "Generation",
      mw: power.generationMw,
      operator: null,
      help: "GB generation in this half-hour, including estimated embedded wind and solar. Pumped storage and batteries count here when they are discharging. Half-hour average of Elexon FUELINST.",
      source: power.generationSource,
    },
  ];

  if (power.importsMw != null && headlineGw(power.importsMw) !== 0) {
    terms.push({
      id: "imports",
      label: "Imports",
      mw: power.importsMw,
      operator: "+",
      help: "Power flowing into Great Britain on the interconnectors. Positive Elexon flow is an import. Half-hour average of FUELINST.",
      source: power.transfersSource,
    });
  }
  if (power.exportsMw != null && headlineGw(power.exportsMw) !== 0) {
    terms.push({
      id: "exports",
      label: "Exports",
      mw: power.exportsMw,
      operator: "−",
      help: "Power flowing out of Great Britain. Shown as a positive number and subtracted. Half-hour average of FUELINST.",
      source: power.transfersSource,
    });
  }
  if (
    power.storageChargingMw != null &&
    headlineGw(power.storageChargingMw) !== 0 &&
    storageKind
  ) {
    terms.push(storageTerm(power.storageChargingMw, storageKind, power.transfersSource));
  }
  terms.push({
    id: "demand",
    label: "Demand",
    mw: power.demandMw,
    operator: power.showEquals ? "=" : null,
    help: power.demandDefinition,
    source: power.demandSource,
  });
  return terms;
}

function openTerms(power: DisplayedPower): HeadlineTerm[] {
  return [
    {
      id: "generation",
      label: "Generation",
      mw: power.generationMw,
      operator: null,
      help: "GB generation including estimated embedded wind and solar. Interconnector flows for this half-hour are incomplete, so this is not closed against demand.",
      source: power.generationSource,
    },
    {
      id: "imports",
      label: "Transfers",
      mw: power.transfersMw,
      operator: null,
      help: "Metered interconnector net flow. A partial interconnector book is not a national total.",
      source: power.transfersSource,
    },
    {
      id: "demand",
      label: "Demand",
      mw: power.demandMw,
      operator: null,
      help: power.demandDefinition,
      source: power.demandSource,
    },
  ];
}

function storageTerm(mw: number, kind: StorageChargingKind, source: string): HeadlineTerm {
  switch (kind) {
    case "pumping":
      return {
        id: "storage_charging",
        label: "Pumping",
        mw,
        operator: "−",
        help: "Pumped storage demand while the stations are pumping. Subtracted here, and not included in generation.",
        source,
      };
    case "battery":
      return {
        id: "storage_charging",
        label: "Charging",
        mw,
        operator: "−",
        help: "Battery charging. Subtracted here, and not included in generation.",
        source,
      };
    case "both":
      return {
        id: "storage_charging",
        label: "Storage",
        mw,
        operator: "−",
        help: "Pumped storage pumping and battery charging. Subtracted here, and not included in generation.",
        source,
      };
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

function demandDefinitionFrom(
  itsdoMwValue: number | null,
  embeddedMw: number,
  demandMw: number
): string {
  const lead =
    "GB electricity use in this half-hour: generation + imports − exports − storage charging, including estimated embedded wind and solar.";
  if (itsdoMwValue == null) {
    return lead;
  }
  const withEmbedded = itsdoMwValue + embeddedMw;
  const itsdo = `Elexon transmission demand (ITSDO) was ${formatHeadlineGw(itsdoMwValue)} GW.`;
  if (Math.abs(withEmbedded - demandMw) <= 100) {
    return `${lead} ${itsdo}`;
  }
  return `${lead} ${itsdo} ITSDO plus embedded is ${formatHeadlineGw(withEmbedded)} GW. ITSDO already counts exports, station load and pumping, so that total is not the demand in this equation.`;
}

function generationSourceFrom(fuels: string[]): string {
  const names = ["Elexon BMRS"];
  if (fuels.includes("embedded_wind")) {
    names.push("NESO");
  }
  if (fuels.includes("embedded_solar")) {
    names.push("Sheffield Solar PV Live");
  }
  return names.join(", ");
}

function itsdoMw(
  facts: LatestFacts,
  snapshots: EnergySnapshot[],
  periodStartUtc: string | null
): number | null {
  if (!periodStartUtc) {
    return null;
  }
  const periodStart = getSettlementPeriod(parseUtcDateTime(periodStartUtc)).startUtc.getTime();
  let latest: number | null = null;
  let latestTimestamp: string | null = null;

  for (const snapshot of snapshots) {
    if (snapshot.demand_mw == null) {
      continue;
    }
    if (getSettlementPeriod(parseUtcDateTime(snapshot.timestamp)).startUtc.getTime() !== periodStart) {
      continue;
    }
    if (!latestTimestamp || snapshot.timestamp > latestTimestamp) {
      latest = snapshot.demand_mw;
      latestTimestamp = snapshot.timestamp;
    }
  }
  if (latest != null) {
    return latest;
  }
  if (
    facts.demand.value != null &&
    facts.demand.periodStartUtc != null &&
    getSettlementPeriod(parseUtcDateTime(facts.demand.periodStartUtc)).startUtc.getTime() === periodStart
  ) {
    return facts.demand.value;
  }
  return null;
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
