import { NESO_HISTORIC_MIX_URL } from "@/lib/attribution";

export const NESO_OFFICIAL_RECORDS_CHECKED_AT = "2026-10-10";

export type NesoOfficialUnit = "MW" | "pct" | "gCO2/kWh";

export type NesoOfficialRecordId =
  | "wind"
  | "solar"
  | "zero_carbon"
  | "renewable_share"
  | "lowest_carbon";

type NesoRecordBase = {
  id: NesoOfficialRecordId;
  unit: NesoOfficialUnit;
  sourceUrl: string;
  checkedAt: string;
};

export type NesoOfficialRecord =
  | (NesoRecordBase & {
      kind: "official";
      value: number;
      observedAtLondon: string;
    })
  | (NesoRecordBase & {
      kind: "historic_mix";
    });

const NESO_ZERO_CARBON_PRESS_URL =
  "https://www.neso.energy/britains-electricity-system-breaks-zero-carbon-record-gas-reaches-historic-low-and-solar-hits-historic-high";

export const NESO_OFFICIAL_RECORDS: Record<NesoOfficialRecordId, NesoOfficialRecord> = {
  wind: {
    id: "wind",
    kind: "official",
    value: 23_880,
    unit: "MW",
    observedAtLondon: "25 Mar 2026, 13:30",
    sourceUrl: NESO_ZERO_CARBON_PRESS_URL,
    checkedAt: NESO_OFFICIAL_RECORDS_CHECKED_AT,
  },
  solar: {
    id: "solar",
    kind: "official",
    value: 15_400,
    unit: "MW",
    observedAtLondon: "23 Apr 2026, 12:30–13:00",
    sourceUrl: NESO_ZERO_CARBON_PRESS_URL,
    checkedAt: NESO_OFFICIAL_RECORDS_CHECKED_AT,
  },
  zero_carbon: {
    id: "zero_carbon",
    kind: "official",
    value: 98.8,
    unit: "pct",
    observedAtLondon: "22 Apr 2026, 15:30",
    sourceUrl: NESO_ZERO_CARBON_PRESS_URL,
    checkedAt: NESO_OFFICIAL_RECORDS_CHECKED_AT,
  },
  renewable_share: {
    id: "renewable_share",
    kind: "historic_mix",
    unit: "pct",
    sourceUrl: NESO_HISTORIC_MIX_URL,
    checkedAt: NESO_OFFICIAL_RECORDS_CHECKED_AT,
  },
  lowest_carbon: {
    id: "lowest_carbon",
    kind: "historic_mix",
    unit: "gCO2/kWh",
    sourceUrl: NESO_HISTORIC_MIX_URL,
    checkedAt: NESO_OFFICIAL_RECORDS_CHECKED_AT,
  },
};

export const HIDE_SOLAR_RECORD = true;

export function formatNesoOfficialLine(
  record: NesoOfficialRecord,
  historic?: { valueLabel: string; whenLabel: string }
): string {
  switch (record.kind) {
    case "official":
      return `NESO official record: ${formatNesoValue(record)}, ${record.observedAtLondon} (source: NESO)`;
    case "historic_mix":
      return `NESO historic mix: ${historic?.valueLabel ?? "—"}, ${historic?.whenLabel ?? "date pending"} (source: NESO)`;
    default: {
      const exhaustive: never = record;
      return exhaustive;
    }
  }
}

function formatNesoValue(record: Extract<NesoOfficialRecord, { kind: "official" }>): string {
  switch (record.unit) {
    case "MW":
      return `${record.value.toLocaleString("en-GB")} MW`;
    case "pct":
      return `${record.value}%`;
    case "gCO2/kWh":
      return `${record.value} gCO₂/kWh`;
    default: {
      const exhaustive: never = record.unit;
      return exhaustive;
    }
  }
}
