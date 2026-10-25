import { publicOperatorError } from "@/lib/power-cuts/copy";
import { POWER_CUTS_FRESH_MS } from "@/lib/power-cuts/model";
import { loadPowerCutsSnapshot } from "@/lib/power-cuts/reader";
import { OPERATORS, type Operator, type SourceReport, type SourceStatus } from "@/lib/power-cuts/schema";

export type PowerCutsHealthSource = {
  operator: Operator;
  status: SourceStatus | "not_yet_available";
  fetchedAt: string | null;
  count: number;
  error?: string;
};

export type PowerCutsHealth = {
  fetchedAt: string | null;
  sources: PowerCutsHealthSource[];
};

function agedStatus(report: SourceReport, now: Date): SourceStatus {
  if (report.status === "unlicensed" || report.status === "absent") {
    return report.status;
  }
  const fetchedAt = report.fetchedAt ? new Date(report.fetchedAt).getTime() : Number.NaN;
  if (!Number.isFinite(fetchedAt) || now.getTime() - fetchedAt > POWER_CUTS_FRESH_MS) {
    return "stale";
  }
  return report.status;
}

export async function loadPowerCutsHealth(now = new Date()): Promise<PowerCutsHealth> {
  try {
    const snapshot = await loadPowerCutsSnapshot();
    if (!snapshot) {
      return {
        fetchedAt: null,
        sources: OPERATORS.map((operator) => ({
          operator,
          status: "not_yet_available",
          fetchedAt: null,
          count: 0,
        })),
      };
    }
    return {
      fetchedAt: snapshot.fetchedAt,
      sources: OPERATORS.map((operator) => {
        const report = snapshot.sources[operator];
        const error = publicOperatorError(report.error);
        return {
          operator,
          status: agedStatus(report, now),
          fetchedAt: report.fetchedAt,
          count: report.count,
          ...(error ? { error } : {}),
        };
      }),
    };
  } catch {
    return {
      fetchedAt: null,
      sources: OPERATORS.map((operator) => ({
        operator,
        status: "not_yet_available",
        fetchedAt: null,
        count: 0,
      })),
    };
  }
}
