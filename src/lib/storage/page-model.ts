import { NOT_AVAILABLE } from "@/lib/assets/labels";
import { displayedPercents, formatDisplay, largestRemainder, roundDisplay } from "@/lib/display-rounding";
import {
  CHARGING,
  DISCHARGING,
  ENERGY_ABSENT,
  STORAGE_FLEET_COVERED,
  STORAGE_FLEET_COVERED_HELP,
} from "@/lib/storage/copy";
import type { StorageAsset, StorageInventory } from "@/lib/storage/inventory";
import type { StorageTechnology } from "@/lib/storage/records";
import type { StorageFuelReading, StorageOperations } from "@/lib/storage/operations";
import { OGL_V3_ATTRIBUTION, elexonBmrsAttribution } from "@/lib/attribution";

const MW_QUANTUM = 0.1;

export type StorageShare = {
  technology: StorageTechnology;
  label: string;
  mwLabel: string;
  percent: number;
};

export type StorageRow = {
  id: string;
  name: string;
  href: string | null;
  technology: StorageTechnology;
  technologyLabel: string;
  ratedLabel: string;
  energyLabel: string;
  durationLabel: string;
};

export type StorageMagnitudeRow = {
  id: string;
  label: string;
  mwLabel: string;
};

export type StorageMagnitude = {
  rows: StorageMagnitudeRow[];
  totalLabel: string | null;
  shares: { id: string; label: string; percent: number }[] | null;
  missing: string[];
};

export type StorageDocument = {
  operatingCount: number;
  notOperatingCount: number;
  rated: {
    totalLabel: string;
    shares: StorageShare[];
    omitted: number;
  } | null;
  energy: {
    totalLabel: string;
    omitted: number;
  } | null;
  energyNote: string;
  coverage: {
    label: string;
    help: string;
    percentLabel: string;
    covered: number;
    total: number;
    fractionLabel: string;
  };
  rows: StorageRow[];
  monitored:
    | { available: false }
    | {
        available: true;
        periodLabel: string;
        periodStart: string;
        discharge: StorageMagnitude;
        charge: StorageMagnitude;
      };
  inventoryAttribution: string;
  monitoredAttribution: string;
};

export function technologyLabel(technology: StorageTechnology): string {
  switch (technology) {
    case "pumped_storage":
      return "Pumped storage";
    case "battery":
      return "Battery";
    default: {
      const neverTechnology: never = technology;
      return neverTechnology;
    }
  }
}

function mwLabel(value: number): string {
  return formatDisplay(value, MW_QUANTUM);
}

type Known = { asset: StorageAsset; index: number; value: number };

function knownValues(assets: readonly StorageAsset[], read: (asset: StorageAsset) => number | null): Known[] {
  const known: Known[] = [];
  assets.forEach((asset, index) => {
    const value = read(asset);
    if (value !== null) {
      known.push({ asset, index, value });
    }
  });
  return known;
}

function displayMagnitudes(values: readonly number[]): number[] {
  if (values.length === 0) {
    return [];
  }
  return largestRemainder(values, MW_QUANTUM);
}

export function buildStorageDocument(
  inventory: StorageInventory,
  operations: StorageOperations,
  year: number,
): StorageDocument {
  const operating = inventory.operating;
  const ratedKnown = knownValues(operating, (asset) => asset.ratedMw);
  const ratedShown = displayMagnitudes(ratedKnown.map((item) => item.value));
  const ratedByRow = new Map<number, string>();
  ratedKnown.forEach((item, index) => {
    ratedByRow.set(item.index, mwLabel(ratedShown[index] ?? 0));
  });
  const energyKnown = knownValues(operating, (asset) => asset.energyMwh);
  const energyShown = displayMagnitudes(energyKnown.map((item) => item.value));
  const energyByRow = new Map<number, string>();
  energyKnown.forEach((item, index) => {
    energyByRow.set(item.index, mwLabel(energyShown[index] ?? 0));
  });

  const rows: StorageRow[] = operating.map((asset, index) => ({
    id: asset.id,
    name: asset.name,
    href: asset.href,
    technology: asset.technology,
    technologyLabel: technologyLabel(asset.technology),
    ratedLabel: ratedByRow.get(index) ?? NOT_AVAILABLE,
    energyLabel: energyByRow.get(index) ?? NOT_AVAILABLE,
    durationLabel:
      asset.durationHours === null ? NOT_AVAILABLE : `${mwLabel(asset.durationHours)} h`,
  }));

  const covered = operating.filter((asset) => asset.covered).length;
  const total = operating.length;
  const percent =
    total === 0 ? null : (displayedPercents([(covered / total) * 100, ((total - covered) / total) * 100])[0] ?? 0);

  return {
    operatingCount: total,
    notOperatingCount: inventory.assets.length - total,
    rated: ratedBlock(operating, ratedKnown, ratedShown),
    energy:
      energyKnown.length === 0
        ? null
        : {
            totalLabel: mwLabel(roundDisplay(energyKnown.reduce((sum, item) => sum + item.value, 0), MW_QUANTUM)),
            omitted: operating.length - energyKnown.length,
          },
    energyNote: ENERGY_ABSENT,
    coverage: {
      label: STORAGE_FLEET_COVERED,
      help: STORAGE_FLEET_COVERED_HELP,
      percentLabel: percent === null ? NOT_AVAILABLE : `${percent}%`,
      covered,
      total,
      fractionLabel: `${covered} of ${total}`,
    },
    rows,
    monitored: monitoredBlock(operations),
    inventoryAttribution: OGL_V3_ATTRIBUTION,
    monitoredAttribution: elexonBmrsAttribution(year),
  };
}

function ratedBlock(
  operating: readonly StorageAsset[],
  known: readonly Known[],
  shown: readonly number[],
): StorageDocument["rated"] {
  if (known.length === 0) {
    return null;
  }
  const technologies: StorageTechnology[] = ["pumped_storage", "battery"];
  const parts: { technology: StorageTechnology; exact: number; shown: number }[] = [];
  for (const technology of technologies) {
    let exact = 0;
    let display = 0;
    let any = false;
    known.forEach((item, index) => {
      if (item.asset.technology !== technology) {
        return;
      }
      any = true;
      exact += item.value;
      display += shown[index] ?? 0;
    });
    if (any) {
      parts.push({ technology, exact, shown: roundDisplay(display, MW_QUANTUM) });
    }
  }
  const exactTotal = known.reduce((sum, item) => sum + item.value, 0);
  const percents =
    exactTotal > 0 ? displayedPercents(parts.map((part) => (part.exact / exactTotal) * 100)) : parts.map(() => 0);
  return {
    totalLabel: mwLabel(roundDisplay(exactTotal, MW_QUANTUM)),
    omitted: operating.length - known.length,
    shares: parts.map((part, index) => ({
      technology: part.technology,
      label: technologyLabel(part.technology),
      mwLabel: mwLabel(part.shown),
      percent: percents[index] ?? 0,
    })),
  };
}

function fuelParts(operations: Extract<StorageOperations, { available: true }>, read: (fuel: StorageFuelReading) => number) {
  const parts: { id: string; label: string; mw: number }[] = [];
  const missing: string[] = [];
  if (operations.pumped) {
    parts.push({ id: "pumped_storage", label: technologyLabel("pumped_storage"), mw: read(operations.pumped) });
  } else {
    missing.push(technologyLabel("pumped_storage"));
  }
  if (operations.battery) {
    parts.push({ id: "battery", label: technologyLabel("battery"), mw: read(operations.battery) });
  } else {
    missing.push(technologyLabel("battery"));
  }
  return { parts, missing };
}

function magnitude(title: string, operations: Extract<StorageOperations, { available: true }>, read: (fuel: StorageFuelReading) => number): StorageMagnitude {
  const { parts, missing } = fuelParts(operations, read);
  const shown = displayMagnitudes(parts.map((part) => part.mw));
  const complete = missing.length === 0 && parts.length > 0;
  const exactTotal = parts.reduce((sum, part) => sum + part.mw, 0);
  const percents =
    complete && exactTotal > 0 ? displayedPercents(parts.map((part) => (part.mw / exactTotal) * 100)) : null;
  return {
    rows: parts.map((part, index) => ({
      id: `${title}:${part.id}`,
      label: part.label,
      mwLabel: mwLabel(shown[index] ?? 0),
    })),
    totalLabel: complete ? mwLabel(roundDisplay(exactTotal, MW_QUANTUM)) : null,
    shares:
      percents === null
        ? null
        : parts.map((part, index) => ({
            id: part.id,
            label: part.label,
            percent: percents[index] ?? 0,
          })),
    missing,
  };
}

function monitoredBlock(operations: StorageOperations): StorageDocument["monitored"] {
  if (!operations.available) {
    return { available: false };
  }
  return {
    available: true,
    periodLabel: operations.periodLabel,
    periodStart: operations.periodStart,
    discharge: magnitude(DISCHARGING, operations, (fuel) => fuel.dischargeMw),
    charge: magnitude(CHARGING, operations, (fuel) => fuel.chargeMw),
  };
}
