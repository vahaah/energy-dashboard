/** Thin space between a number and its unit. */
export const THIN_SPACE = "\u2009";

const MW_TO_GW = 1000;

export type EnergyUnit = "MW" | "GW";

export type EnergyQuantity = {
  value: string;
  unit: EnergyUnit;
};

export function formatGrouped(value: number, digits: number): string {
  if (!Number.isFinite(value)) {
    throw new Error("formatGrouped requires a finite number");
  }
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: true,
  }).format(value);
}

/**
 * Separators, and GW at one decimal once the magnitude reaches 1,000 MW.
 * Below that, whole MW, or one decimal when the value is under 100 MW and not whole.
 */
export function formatEnergy(mw: number): EnergyQuantity {
  if (!Number.isFinite(mw)) {
    throw new Error("formatEnergy requires a finite number");
  }
  const abs = Math.abs(mw);
  if (abs >= MW_TO_GW) {
    return { value: formatGrouped(mw / MW_TO_GW, 1), unit: "GW" };
  }
  const fractional = Math.abs(mw - Math.round(mw)) > 1e-9;
  const digits = abs > 0 && abs < 100 && fractional ? 1 : 0;
  return { value: formatGrouped(mw, digits), unit: "MW" };
}

export function formatEnergyText(mw: number): string {
  const quantity = formatEnergy(mw);
  return `${quantity.value}${THIN_SPACE}${quantity.unit}`;
}
