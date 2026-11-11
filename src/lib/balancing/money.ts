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
