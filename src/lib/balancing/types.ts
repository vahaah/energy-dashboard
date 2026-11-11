import type { CategoryPence } from "@/lib/balancing/categories";

export type BalancingDay = {
  date: string;
  periods: number;
  expected_periods: number;
  provisional: boolean;
  pence: CategoryPence;
};

export type TariffPublication = "Final" | "Draft";

export type BalancingTariff = {
  title: string;
  publication: TariffPublication;
  published: string;
  from: string;
  to: string;
  gbp_per_mwh: number;
};

export type TradeCountry = {
  country: string;
  import_pence: number;
  export_pence: number;
  import_mwh: number;
  export_mwh: number;
};

export type TradeDay = {
  date: string;
  expected_periods: number;
  observed_periods: number;
  unpriced_periods: number;
  provisional: boolean;
  countries: TradeCountry[];
};

export type TradeMonth = {
  month: string;
  provisional: boolean;
  countries: TradeCountry[];
};

export type BalancingRelease = {
  schema_version: 1;
  generated_at: string;
  costs_issued_at: string | null;
  tariffs_issued_at: string | null;
  trade_retrieved_at: string | null;
  days: BalancingDay[];
  tariffs: BalancingTariff[];
  trade_months: TradeMonth[];
  /** Daily grain so a later 7-day fetch can revise a month. The page does not send this to the browser. */
  trade_days: TradeDay[];
};

export const BALANCING_RANGES = ["90d", "1y", "fy", "all"] as const;

export type BalancingRange = (typeof BALANCING_RANGES)[number];

export type HomeCardFile = {
  schema_version: 1;
  latest_date: string | null;
  latest_pence: number | null;
  latest_provisional: boolean;
  financial_year: string | null;
  fy_pence: number | null;
  fy_through: string | null;
  constraints_share: number | null;
  tariff_gbp_per_mwh: number | null;
  tariff_label: string | null;
  household_pence: number | null;
  generated_at: string | null;
};
