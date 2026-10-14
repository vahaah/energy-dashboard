import { FatalError, RetryableError, getStepMetadata } from "workflow";
import {
  getGenerationQueryParams,
  getInterconnectorQueryParams,
  getPricesQueryParams,
  getSnapshotsQueryParams,
} from "@/lib/dashboard-data";
import type { StepStatus } from "@/lib/step-status";
import { reserveTinybirdOp } from "@/lib/tinybird-ops";
import { fetchPipeRows, TinybirdHttpError } from "@/lib/tinybird";
import { storeWarmedRows } from "@/lib/warm-envelope";
import type { CommodityRange, TinybirdTimeRange } from "@/lib/types";

export type WarmCadence = "30m" | "6h";

export type WarmPipe = {
  id: string;
  pipe: string;
  range: TinybirdTimeRange | CommodityRange;
  cadence: WarmCadence;
  params: (now: Date) => Record<string, string>;
};

export const LIVE_PIPES: readonly WarmPipe[] = [
  {
    id: "snapshots_range:24h",
    pipe: "snapshots_range",
    range: "24h",
    cadence: "30m",
    params: (now) => getSnapshotsQueryParams("24h", now),
  },
  {
    id: "snapshots_range:7d",
    pipe: "snapshots_range",
    range: "7d",
    cadence: "30m",
    params: (now) => getSnapshotsQueryParams("7d", now),
  },
  {
    id: "generation_5min_range:24h",
    pipe: "generation_5min_range",
    range: "24h",
    cadence: "30m",
    params: (now) => getGenerationQueryParams("24h", now),
  },
  {
    id: "generation_5min_range:7d",
    pipe: "generation_5min_range",
    range: "7d",
    cadence: "30m",
    params: (now) => getGenerationQueryParams("7d", now),
  },
  {
    id: "interconnector_flows:24h",
    pipe: "interconnector_flows",
    range: "24h",
    cadence: "30m",
    params: (now) => getInterconnectorQueryParams("24h", now),
  },
  {
    id: "interconnector_flows:7d",
    pipe: "interconnector_flows",
    range: "7d",
    cadence: "30m",
    params: (now) => getInterconnectorQueryParams("7d", now),
  },
];

export const LONG_PIPES: readonly WarmPipe[] = [
  {
    id: "snapshots_range:30d",
    pipe: "snapshots_range",
    range: "30d",
    cadence: "6h",
    params: (now) => getSnapshotsQueryParams("30d", now),
  },
  {
    id: "snapshots_range:90d",
    pipe: "snapshots_range",
    range: "90d",
    cadence: "6h",
    params: (now) => getSnapshotsQueryParams("90d", now),
  },
  {
    id: "snapshots_range:1y",
    pipe: "snapshots_range",
    range: "1y",
    cadence: "6h",
    params: (now) => getSnapshotsQueryParams("1y", now),
  },
  {
    id: "generation_5min_range:30d",
    pipe: "generation_5min_range",
    range: "30d",
    cadence: "6h",
    params: (now) => getGenerationQueryParams("30d", now),
  },
  {
    id: "generation_5min_range:90d",
    pipe: "generation_5min_range",
    range: "90d",
    cadence: "6h",
    params: (now) => getGenerationQueryParams("90d", now),
  },
  {
    id: "generation_5min_range:1y",
    pipe: "generation_5min_range",
    range: "1y",
    cadence: "6h",
    params: (now) => getGenerationQueryParams("1y", now),
  },
  {
    id: "prices_range:30d",
    pipe: "prices_range",
    range: "30d",
    cadence: "6h",
    params: (now) => getPricesQueryParams("30d", now),
  },
  {
    id: "prices_range:90d",
    pipe: "prices_range",
    range: "90d",
    cadence: "6h",
    params: (now) => getPricesQueryParams("90d", now),
  },
  {
    id: "prices_range:1y",
    pipe: "prices_range",
    range: "1y",
    cadence: "6h",
    params: (now) => getPricesQueryParams("1y", now),
  },
];

const PIPES_BY_ID = new Map<string, WarmPipe>(
  [...LIVE_PIPES, ...LONG_PIPES].map((pipe) => [pipe.id, pipe])
);

export function warmPipe(id: string): WarmPipe {
  const pipe = PIPES_BY_ID.get(id);
  if (!pipe) {
    throw new FatalError(`unknown warm pipe ${id}`);
  }
  return pipe;
}

export function tinybirdRetryAfter(attempt: number, header: string | null): string {
  if (header && header.trim() !== "") {
    return header.trim();
  }
  return attempt <= 1 ? "30s" : "2m";
}

export function stepAttempt(): number {
  try {
    return getStepMetadata().attempt;
  } catch {
    return 1;
  }
}

export function toTinybirdStepError(error: unknown): Error {
  if (error instanceof FatalError || error instanceof RetryableError) {
    return error;
  }

  const attempt = stepAttempt();
  if (error instanceof TinybirdHttpError) {
    if (error.status === 400 || /schema|unknown column|code:\s*47/i.test(error.body)) {
      return new FatalError(`tinybird ${error.status}`);
    }
    return new RetryableError(`tinybird ${error.status}`, {
      retryAfter: asRetryAfter(tinybirdRetryAfter(attempt, error.retryAfter)),
    });
  }

  const message = error instanceof Error ? error.message : "tinybird failed";
  return new RetryableError(message, {
    retryAfter: asRetryAfter(tinybirdRetryAfter(attempt, null)),
  });
}

/** `ms` types durations as a template literal. The header is still passed through. */
function asRetryAfter(value: string): "30s" {
  return value as "30s";
}

/** One pipe. Caller runs these in order; a later failure must not repeat earlier ids. */
export async function warmPipeById(id: string, now: Date): Promise<StepStatus> {
  const spec = warmPipe(id);
  const params = spec.params(now);
  await reserveTinybirdOp(now);
  let rows: unknown[];
  try {
    rows = await fetchPipeRows(spec.pipe, params);
  } catch (error) {
    throw toTinybirdStepError(error);
  }
  return storeWarmedRows(spec, params, rows, now);
}

export async function runWarmSeries(
  ids: readonly string[],
  now: Date,
  completed: ReadonlySet<string> = new Set()
): Promise<Set<string>> {
  const done = new Set(completed);
  for (const id of ids) {
    if (done.has(id)) {
      continue;
    }
    await warmPipeById(id, now);
    done.add(id);
  }
  return done;
}
