/**
 * DUKES table 1.1 is published in thousand tonnes of oil equivalent (ktoe).
 * Standard conversion factors in DUKES: 1 toe = 11,630 kWh.
 * 1 ktoe = 1,000 × 11,630 kWh = 0.01163 TWh.
 * Cells are stored as 0.01 ktoe, the published precision, then converted.
 * TWh = centi × 1163 / 10_000_000.
 */

export const TOE_KWH = 11630;
export const KTOE_TO_TWH_FACTOR = "0.01163";
export const KTOE_DECIMALS = 2;
export const DISPLAY_QUANTUM_TWH = 0.1;
export const CONVERSION_STATEMENT = "1 toe = 11,630 kWh, so 1 ktoe = 0.01163 TWh.";

const CENTI = 100;
const TWH_NUMERATOR = 1163;
const TWH_DENOMINATOR = 10_000_000;

export function ktoeCentiFromNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("ktoe value is not finite");
  }
  return Math.round(value * CENTI);
}

export function formatKtoeCenti(centi: number): string {
  if (!Number.isInteger(centi)) {
    throw new Error("ktoe centi must be an integer");
  }
  const sign = centi < 0 ? "-" : "";
  const abs = Math.abs(centi);
  const whole = Math.floor(abs / CENTI);
  const frac = String(abs % CENTI).padStart(2, "0");
  return `${sign}${whole}.${frac}`;
}

export function ktoeCenti(text: string): number {
  const match = /^(-?)(\d+)\.(\d{2})$/.exec(text);
  if (!match?.[2] || !match[3]) {
    throw new Error(`ktoe text is not 0.01 precision: ${text}`);
  }
  const centi = Number(match[2]) * CENTI + Number(match[3]);
  return match[1] === "-" ? -centi : centi;
}

export function ktoeCentiToTwh(centi: number): number {
  return (centi * TWH_NUMERATOR) / TWH_DENOMINATOR;
}

export function ktoeTextToTwh(text: string): number {
  return ktoeCentiToTwh(ktoeCenti(text));
}
