import { loadPowerCutsSnapshot } from "@/lib/power-cuts/reader";
import { OPERATORS, type Operator, type SourceStatus } from "@/lib/power-cuts/schema";

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

export async function loadPowerCutsHealth(): Promise<PowerCutsHealth> {
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
        return {
          operator,
          status: report.status,
          fetchedAt: report.fetchedAt,
          count: report.count,
          ...(report.error ? { error: report.error } : {}),
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
