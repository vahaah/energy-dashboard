import { ABSENT_FIGURE } from "@/lib/data-state";

export const ELECTRICITY_STALE_MS = 60 * 60 * 1000;
export const GAS_STALE_MS = 2 * 60 * 60 * 1000;
export const CHEVRON_CYCLE_MS = 2_400;

export const FLOW_WIDTH_PX = [2, 4, 6] as const;
export type FlowWidthPx = (typeof FLOW_WIDTH_PX)[number];

export const ELECTRICITY_DIRECTION = {
  import: "Importing to GB",
  export: "Exporting from GB",
} as const;

export const GAS_DIRECTION = {
  into: "Into the GB system",
  out: "Out of the GB system",
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

export function gasDirectionWords(role: "entry" | "exit", mcmPerDay: number | null): string | null {
  const direction = gasDirection(role, mcmPerDay);
  return direction ? GAS_DIRECTION[direction] : null;
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
    return "Net electricity —";
  }
  const words = mw > 0 ? "Net import" : mw < 0 ? "Net export" : "Balanced";
  const missingText = missing > 0 ? `, ${missing} missing` : "";
  return `${words} ${formatFlowReading(Math.abs(mw), "MW")} across ${included} links${missingText}`;
}

export function netGasLabel(mcm: number | null): string {
  if (mcm === null) {
    return "Net gas —";
  }
  if (mcm > 0) {
    return `Net into the GB system ${formatFlowReading(mcm, "mcm/d")}`;
  }
  if (mcm < 0) {
    return `Net out of the GB system ${formatFlowReading(Math.abs(mcm), "mcm/d")}`;
  }
  return `Net gas ${formatFlowReading(0, "mcm/d")}`;
}

export function utilisationPercent(absValue: number | null, capacity: number | null): number | null {
  if (absValue === null || capacity === null || !(capacity > 0) || !Number.isFinite(absValue)) {
    return null;
  }
  return Math.round((absValue / capacity) * 100);
}
