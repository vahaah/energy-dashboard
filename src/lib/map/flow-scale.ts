import { ABSENT_FIGURE } from "@/lib/data-state";
import { formatEnergyText } from "@/lib/format/quantity";

export const ELECTRICITY_STALE_MS = 60 * 60 * 1000;
/** Banner waits out the same 90 minutes as the FUELINST delay note. Chevrons still pause at ELECTRICITY_STALE_MS. */
export const ELECTRICITY_BANNER_STALE_MS = 90 * 60 * 1000;
export const GAS_STALE_MS = 2 * 60 * 60 * 1000;
export const CHEVRON_CYCLE_MS = 2_400;

export const FLOW_WIDTH_PX = [2, 4, 6] as const;
export type FlowWidthPx = (typeof FLOW_WIDTH_PX)[number];

export const ELECTRICITY_DIRECTION = {
  import: "Into GB",
  export: "Out of GB",
} as const;

export const GAS_DIRECTION = {
  into: "Into GB",
  out: "Out of GB",
} as const;

export type ElectricityDirection = keyof typeof ELECTRICITY_DIRECTION;
export type GasDirection = keyof typeof GAS_DIRECTION;

/** Under 500, 500–1,000, over 1,000 MW. A missing reading has no width. */
export function electricityWidthPx(absMw: number | null): FlowWidthPx | null {
  if (absMw === null || !Number.isFinite(absMw)) {
    return null;
  }
  if (absMw < 500) {
    return 2;
  }
  if (absMw <= 1_000) {
    return 4;
  }
  return 6;
}

/** Under 20, 20–50, over 50 million m³/day. */
export function gasWidthPx(mcmPerDay: number | null): FlowWidthPx | null {
  if (mcmPerDay === null || !Number.isFinite(mcmPerDay)) {
    return null;
  }
  const magnitude = Math.abs(mcmPerDay);
  if (magnitude < 20) {
    return 2;
  }
  if (magnitude <= 50) {
    return 4;
  }
  return 6;
}

export function electricityDirection(mw: number | null): ElectricityDirection | null {
  if (mw === null || !Number.isFinite(mw) || mw === 0) {
    return null;
  }
  return mw > 0 ? "import" : "export";
}

export function electricityDirectionWords(mw: number | null): string | null {
  const direction = electricityDirection(mw);
  return direction ? ELECTRICITY_DIRECTION[direction] : null;
}

/** Entry supply is into the system. An exit such as Moffat is out. Zero is a published reading with no direction. */
export function gasDirection(role: "entry" | "exit", mcmPerDay: number | null): GasDirection | null {
  if (mcmPerDay === null || !Number.isFinite(mcmPerDay) || mcmPerDay === 0) {
    return null;
  }
  if (role === "exit") {
    return mcmPerDay > 0 ? "out" : "into";
  }
  return mcmPerDay > 0 ? "into" : "out";
}

export const ZERO_FLOW_LABEL = "Zero flow";

export function gasDirectionWords(role: "entry" | "exit", mcmPerDay: number | null): string | null {
  if (mcmPerDay === 0) {
    return ZERO_FLOW_LABEL;
  }
  const direction = gasDirection(role, mcmPerDay);
  return direction ? GAS_DIRECTION[direction] : null;
}

/** Chevrons move only for a published import, export, entry, or exit. A zero flow stays still. */
export function flowDirectionMoves(direction: string | null): boolean {
  return (
    direction === ELECTRICITY_DIRECTION.import ||
    direction === ELECTRICITY_DIRECTION.export ||
    direction === GAS_DIRECTION.into ||
    direction === GAS_DIRECTION.out
  );
}

export function flowListLine(direction: string | null, reading: string): string {
  return direction ? `${direction} · ${reading}` : reading;
}

export function readingIsStale(at: string | null, now: Date, thresholdMs: number): boolean {
  if (!at) {
    return false;
  }
  const parsed = Date.parse(at);
  if (!Number.isFinite(parsed)) {
    return true;
  }
  return now.getTime() - parsed > thresholdMs;
}

export function formatFlowReading(value: number | null, unit: string): string {
  if (value === null || !Number.isFinite(value)) {
    return ABSENT_FIGURE;
  }
  const digits = unit === "MW" ? 0 : 1;
  const text = Math.abs(value).toLocaleString("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${text} ${unit}`;
}

export function netElectricityLabel(mw: number | null, included: number, missing: number): string {
  if (mw === null) {
    return "Net electricity not available";
  }
  const words = mw > 0 ? "Net import" : mw < 0 ? "Net export" : "Balanced";
  const missingText = missing > 0 ? `, ${missing} missing` : "";
  const links = included === 1 ? "interconnector" : "interconnectors";
  return `${words} ${formatEnergyText(Math.abs(mw))} across ${included} ${links}${missingText}`;
}

export function netGasLabel(mcm: number | null, missing = 0): string {
  if (missing > 0) {
    const noun = missing === 1 ? "terminal" : "terminals";
    return `Partial gas coverage, ${missing} ${noun} missing`;
  }
  if (mcm === null) {
    return "Net gas not available";
  }
  if (mcm > 0) {
    return `Net gas into GB ${formatFlowReading(mcm, "mcm/d")} (million m³/day)`;
  }
  if (mcm < 0) {
    return `Net gas out of GB ${formatFlowReading(Math.abs(mcm), "mcm/d")} (million m³/day)`;
  }
  return `Net gas ${formatFlowReading(0, "mcm/d")}`;
}

export function utilisationPercent(absValue: number | null, capacity: number | null): number | null {
  if (absValue === null || capacity === null || !(capacity > 0) || !Number.isFinite(absValue)) {
    return null;
  }
  return Math.round((absValue / capacity) * 100);
}
