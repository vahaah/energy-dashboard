import { NESO_OPEN_DATA_ATTRIBUTION, NESO_OPEN_DATA_LICENCE_URL, elexonBmrsAttribution, ELEXON_BMRS_LICENCE_URL } from "@/lib/attribution";
import { financialYearLabel } from "@/lib/balancing/aggregate";
import { HOUSEHOLD_METHOD } from "@/lib/balancing/household";
import { formatPounds, formatShare, formatTariff } from "@/lib/balancing/money";
import type { HomeCardFile } from "@/lib/balancing/types";
import type { SourceCredit } from "@/lib/webmcp/result";

export type BalancingSummary = {
  latestDate: string | null;
  latestPence: number | null;
  latestPounds: string | null;
  latestIncomplete: boolean;
  latestPeriods: number | null;
  latestExpectedPeriods: number | null;
  financialYear: string | null;
  financialYearLabel: string | null;
  financialYearPence: number | null;
  financialYearPounds: string | null;
  financialYearThrough: string | null;
  constraintsShare: number | null;
  constraintsShareLabel: string | null;
  tariffGbpPerMwh: number | null;
  tariffLabel: string | null;
  householdPence: number | null;
  householdPounds: string | null;
  householdMethod: string;
  generatedAt: string | null;
};

export function balancingSources(year: number): SourceCredit[] {
  return [
    {
      name: "NESO",
      attribution: NESO_OPEN_DATA_ATTRIBUTION,
      url: NESO_OPEN_DATA_LICENCE_URL,
    },
    {
      name: "Elexon BMRS",
      attribution: elexonBmrsAttribution(year),
      url: ELEXON_BMRS_LICENCE_URL,
    },
  ];
}

function pounds(pence: number | null): string | null {
  if (pence == null || !Number.isFinite(pence)) {
    return null;
  }
  return formatPounds(pence);
}

function summary(input: {
  latestDate: string | null;
  latestPence: number | null;
  latestIncomplete: boolean;
  latestPeriods: number | null;
  latestExpectedPeriods: number | null;
  financialYear: string | null;
  financialYearPence: number | null;
  financialYearThrough: string | null;
  constraintsShare: number | null;
  tariffGbpPerMwh: number | null;
  tariffLabel: string | null;
  householdPence: number | null;
  generatedAt: string | null;
}): BalancingSummary {
  const year = input.financialYear;
  return {
    latestDate: input.latestDate,
    latestPence: input.latestPence,
    latestPounds: pounds(input.latestPence),
    latestIncomplete: input.latestIncomplete,
    latestPeriods: input.latestPeriods,
    latestExpectedPeriods: input.latestExpectedPeriods,
    financialYear: year,
    financialYearLabel: year ? financialYearLabel(year) : null,
    financialYearPence: input.financialYearPence,
    financialYearPounds: pounds(input.financialYearPence),
    financialYearThrough: input.financialYearThrough,
    constraintsShare: input.constraintsShare,
    constraintsShareLabel: input.constraintsShare == null ? null : formatShare(input.constraintsShare),
    tariffGbpPerMwh: input.tariffGbpPerMwh,
    tariffLabel:
      input.tariffLabel ??
      (input.tariffGbpPerMwh == null ? null : formatTariff(input.tariffGbpPerMwh)),
    householdPence: input.householdPence,
    householdPounds: pounds(input.householdPence),
    householdMethod: HOUSEHOLD_METHOD,
    generatedAt: input.generatedAt,
  };
}

export function balancingFromCard(card: HomeCardFile): BalancingSummary {
  return summary({
    latestDate: card.latest_date,
    latestPence: card.latest_pence,
    latestIncomplete: card.latest_incomplete,
    latestPeriods: card.latest_periods,
    latestExpectedPeriods: card.latest_expected_periods,
    financialYear: card.financial_year,
    financialYearPence: card.fy_pence,
    financialYearThrough: card.fy_through,
    constraintsShare: card.constraints_share,
    tariffGbpPerMwh: card.tariff_gbp_per_mwh,
    tariffLabel: card.tariff_label,
    householdPence: card.household_pence,
    generatedAt: card.generated_at,
  });
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Keeps the summary fields. Day rows and trade months are not returned. */
export function balancingFromApi(body: unknown): BalancingSummary | null {
  if (!body || typeof body !== "object" || "error" in body) {
    return null;
  }
  const record = body as {
    latest?: unknown;
    financial_year?: unknown;
    fy_pence?: unknown;
    constraints_share?: unknown;
    tariff_gbp_per_mwh?: unknown;
    household_pence?: unknown;
  };
  if (!("latest" in record) && !("fy_pence" in record)) {
    return null;
  }
  const latest = record.latest && typeof record.latest === "object" ? record.latest as {
    date?: unknown;
    pence?: unknown;
    provisional?: unknown;
    periods?: unknown;
    expectedPeriods?: unknown;
  } : null;
  return summary({
    latestDate: latest ? text(latest.date) : null,
    latestPence: latest ? finite(latest.pence) : null,
    latestIncomplete: latest?.provisional === true,
    latestPeriods: latest ? finite(latest.periods) : null,
    latestExpectedPeriods: latest ? finite(latest.expectedPeriods) : null,
    financialYear: text(record.financial_year),
    financialYearPence: finite(record.fy_pence),
    financialYearThrough: null,
    constraintsShare: finite(record.constraints_share),
    tariffGbpPerMwh: finite(record.tariff_gbp_per_mwh),
    tariffLabel: null,
    householdPence: finite(record.household_pence),
    generatedAt: null,
  });
}
