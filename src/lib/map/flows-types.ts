import type { FlowWidthPx } from "@/lib/map/flow-scale";

export type FlowsFeature = {
  id: string;
  kind: "interconnector" | "gas_terminal";
  name: string;
  href: string;
  latitude: number;
  counterparty: string | null;
  counterpartyOutsideGb: boolean;
  landing: string;
  remoteLanding: string | null;
  credit: string;
  capacityLabel: string;
  utilisation: string | null;
  reading: string;
  readingAt: string | null;
  /** Signed MW, or million m³/day. Null is a missing reading. */
  value: number | null;
  direction: string | null;
  width: FlowWidthPx | null;
  unit: "MW" | "mcm/d";
  spark: (number | null)[] | null;
  gbLongitude: number;
  gbLatitude: number;
  remoteLongitude: number | null;
  remoteLatitude: number | null;
};

export type FlowsCredit = {
  id: string;
  text: string;
  layer: "basemap" | "dno" | "electricity" | "gas" | "places";
};

export type FlowsPageModel = {
  title: string;
  standfirst: string;
  straightLine: string;
  gasUnavailable: string;
  feed: "ok" | "unavailable";
  gasFlows: "published" | "unavailable";
  features: FlowsFeature[];
  electricityLatestAt: string | null;
  gasLatestAt: string | null;
  netElectricityMw: number | null;
  electricityIncluded: number;
  electricityMissing: number;
  netGasMcm: number | null;
  credits: FlowsCredit[];
  dnoPath: string;
  dnoWarning: string | null;
};
