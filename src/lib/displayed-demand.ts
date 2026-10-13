import { isEmbeddedFuel, splitLatestGenerationRows } from "@/lib/dashboard-model";
import { formatHeadlineGw, type LatestFacts } from "@/lib/facts";
import { alignAnswerPeriod } from "@/lib/generation-desk-view";
import { STORAGE_CHARGING_MIN_MW } from "@/lib/generation-share";
import {
  buildSettlementBalance,
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
  role: string;
  mw: number | null;
  operator: HeadlineOperator | null;
  help: string;
  source: string;
  roundingNote: string | null;
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
  publishesBatteryCharging: boolean;
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
  const generationMw = closed ? balance.generationMw : aligned.generationMw.value;
  const demandMw = closed ? balance.demandMw : aligned.demand.value;
  const transfersMw = closed ? balance.netTransfersMw : aligned.netImportsMw.value;
  const generationSource = closed
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
    publishesBatteryCharging:
      closed && (balance.storageKind === "battery" || balance.storageKind === "both"),
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

export const BALANCE_ROUNDING_NOTE = "Rounded to 0.1 GW from unrounded megawatts.";

export function balanceEquationSentence(power: DisplayedPower): string {
  const parts = power.terms.map((term) => {
    const value = `${formatHeadlineGw(unsignedMw(term.mw))} GW`;
    switch (term.operator) {
      case "+":
        return `plus ${term.label} ${value}`;
      case "−":
        return `minus ${term.label} ${value}`;
      case "=":
        return `equals ${term.label} ${value}`;
      case null:
        return `${term.label} ${value}`;
      default: {
        const exhaustive: never = term.operator;
        return exhaustive;
      }
    }
  });
  if (!power.balanceClosed) {
    return `${parts.join(", ")}. Not a closed equation.`;
  }
  return `${parts.join(", ")}.`;
}

function unsignedMw(mw: number | null): number | null {
  if (mw == null) {
    return null;
  }
  return Math.abs(mw);
}

function headlineTerms(
  power: DisplayedPower,
  storageKind: StorageChargingKind | null
): HeadlineTerm[] {
  if (!power.balanceClosed) {
    return openTerms(power);
  }

  const roundingNote = power.showEquals ? null : BALANCE_ROUNDING_NOTE;
  const terms: HeadlineTerm[] = [
    {
      id: "generation",
      label: "Generation",
      role: "Plant and embedded wind and solar",
      mw: power.generationMw,
      operator: null,
      help: "GB generation in this half-hour, including estimated embedded wind and solar. Generation includes storage discharge. Half-hour average of Elexon FUELINST.",
      source: power.generationSource,
      roundingNote: null,
    },
    {
      id: "imports",
      label: "Imports",
      role: "Power flowing into Britain",
      mw: power.importsMw,
      operator: "+",
      help: "Power flowing into Great Britain on the interconnectors. Positive Elexon flow is an import. Half-hour average of FUELINST.",
      source: power.transfersSource,
      roundingNote: null,
    },
    {
      id: "exports",
      label: "Exports",
      role: "Power flowing out of Britain",
      mw: power.exportsMw,
      operator: "−",
      help: "Power flowing out of Great Britain. Shown as a positive number and subtracted. Half-hour average of FUELINST.",
      source: power.transfersSource,
      roundingNote: null,
    },
  ];

  if (
    power.storageChargingMw != null &&
    power.storageChargingMw >= STORAGE_CHARGING_MIN_MW &&
    storageKind
  ) {
    terms.push(storageTerm(power.storageChargingMw, storageKind, power.transfersSource));
  }
  terms.push({
    id: "demand",
    label: "Demand",
    role: "Electricity use this half-hour",
    mw: power.demandMw,
    operator: "=",
    help: roundingNote ? `${power.demandDefinition} ${roundingNote}` : power.demandDefinition,
    source: power.demandSource,
    roundingNote,
  });
  return terms;
}

function openTerms(power: DisplayedPower): HeadlineTerm[] {
  return [
    {
      id: "generation",
      label: "Generation",
      role: "Plant and embedded wind and solar",
      mw: power.generationMw,
      operator: null,
      help: "GB generation including estimated embedded wind and solar. Interconnector flows for this half-hour are incomplete, so this is not closed against demand.",
      source: power.generationSource,
      roundingNote: null,
    },
    {
      id: "imports",
      label: "Transfers",
      role: "Interconnector net flow",
      mw: power.transfersMw,
      operator: null,
      help: "Metered interconnector net flow. A partial interconnector book is not a national total.",
      source: power.transfersSource,
      roundingNote: null,
    },
    {
      id: "demand",
      label: "Demand",
      role: "Electricity use this half-hour",
      mw: power.demandMw,
      operator: null,
      help: power.demandDefinition,
      source: power.demandSource,
      roundingNote: null,
    },
  ];
}

function storageTerm(mw: number, kind: StorageChargingKind, source: string): HeadlineTerm {
  const base = {
    id: "storage_charging" as const,
    label: "Storage charging",
    mw,
    operator: "−" as const,
    source,
    roundingNote: null,
  };
  switch (kind) {
    case "pumping":
      return {
        ...base,
        role: "Pumped storage pumping",
        help: "Pumped storage demand while the stations are pumping. Subtracted here, and not included in generation.",
      };
    case "battery":
      return {
        ...base,
        role: "Battery charging",
        help: "Battery charging. Subtracted here, and not included in generation.",
      };
    case "both":
      return {
        ...base,
        role: "Pumped storage and batteries",
        help: "Pumped storage pumping and battery charging. Subtracted here, and not included in generation.",
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
