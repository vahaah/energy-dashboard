import { formatGrouped } from "@/lib/format/quantity";
import { formatPoundAxis } from "@/lib/balancing/money";
import { niceTicks } from "@/lib/nice-ticks";

export type ChartAxis = {
  domain: [number, number];
  ticks: number[];
  format: (value: number) => string;
};

export function poundChartAxis(values: readonly number[]): ChartAxis {
  const finite = values.filter((value) => Number.isFinite(value));
  const min = finite.length > 0 ? Math.min(...finite) : 0;
  const max = finite.length > 0 ? Math.max(...finite) : 0;
  const ticks = niceTicks(min, max, { target: 5 });
  const first = ticks[0] ?? 0;
  const last = ticks[ticks.length - 1] ?? 0;
  return {
    domain: [first, last],
    ticks,
    format: (value: number) => formatPoundAxis(value, ticks),
  };
}

export function tariffChartAxis(values: readonly number[]): ChartAxis {
  const finite = values.filter((value) => Number.isFinite(value));
  const max = finite.length > 0 ? Math.max(...finite) : 0;
  const ticks = niceTicks(0, max, { target: 5 });
  const first = ticks[0] ?? 0;
  const last = ticks[ticks.length - 1] ?? 0;
  const step = ticks.length >= 2 ? Math.abs((ticks[1] ?? 0) - (ticks[0] ?? 0)) : 1;
  const digits = Math.abs(step - Math.round(step)) > 1e-6 ? 1 : 0;
  return {
    domain: [first, last],
    ticks,
    format: (value: number) => {
      const sign = value < 0 ? "−" : "";
      return `${sign}£${formatGrouped(Math.abs(value), digits)}`;
    },
  };
}

export function monthTicks(keys: readonly string[]): string[] | undefined {
  if (keys.length === 0 || keys.length > 6) {
    return undefined;
  }
  return [...keys];
}
