import { formatGrouped } from "@/lib/format/quantity";

export function poundsToPence(pounds: number): number {
  if (!Number.isFinite(pounds)) {
    throw new Error("pounds must be finite");
  }
  return Math.round(pounds * 100);
}

export function penceToPounds(pence: number): number {
  return pence / 100;
}

/** £, £m, or £bn. A leading minus is the typographic minus. */
export function formatPounds(pence: number, millionDigits = 2): string {
  if (!Number.isFinite(pence)) {
    return "—";
  }
  const pounds = pence / 100;
  const sign = pounds < 0 ? "−" : "";
  const abs = Math.abs(pounds);
  if (abs >= 1_000_000_000) {
    return `${sign}£${formatGrouped(abs / 1_000_000_000, 2)}bn`;
  }
  if (abs >= 1_000_000) {
    return `${sign}£${formatGrouped(abs / 1_000_000, millionDigits)}m`;
  }
  if (abs >= 10_000) {
    return `${sign}£${formatGrouped(abs / 1_000, 0)}k`;
  }
  return `${sign}£${formatGrouped(abs, abs >= 100 ? 0 : 2)}`;
}

/**
 * One fraction setting for every tick on a pound axis, including zero.
 * The scale (£, £k, £m, £bn) follows the largest tick.
 */
export function formatPoundAxis(pence: number, ticks: readonly number[]): string {
  if (!Number.isFinite(pence)) {
    return "—";
  }
  let peak = 0;
  for (const tick of ticks) {
    peak = Math.max(peak, Math.abs(tick) / 100);
  }
  const scale = peak >= 1_000_000_000 ? 1_000_000_000 : peak >= 1_000_000 ? 1_000_000 : peak >= 10_000 ? 1_000 : 1;
  const suffix = scale === 1_000_000_000 ? "bn" : scale === 1_000_000 ? "m" : scale === 1_000 ? "k" : "";
  const step = ticks.length >= 2 ? Math.abs((ticks[1] ?? 0) - (ticks[0] ?? 0)) / 100 / scale : 0;
  const digits = Math.abs(step - Math.round(step)) > 1e-6 ? 1 : 0;
  const pounds = pence / 100 / scale;
  const sign = pounds < 0 ? "−" : "";
  return `${sign}£${formatGrouped(Math.abs(pounds), digits)}${suffix}`;
}

export function formatTariff(gbpPerMwh: number): string {
  return `£${formatGrouped(gbpPerMwh, 2)}/MWh`;
}

export function formatShare(share: number | null): string {
  if (share == null || !Number.isFinite(share)) {
    return "—";
  }
  return `${formatGrouped(share * 100, 1)}%`;
}

export function formatGwh(mwh: number): string {
  const gwh = mwh / 1_000;
  const digits = Math.abs(gwh) >= 100 ? 0 : 1;
  return `${formatGrouped(gwh, digits)} GWh`;
}
