import { blobReadOrNull } from "@/lib/blob-read";
import { isUtcInstant } from "@/lib/catalogue/schema";
import {
  GAS_LATEST_PATH,
  GAS_POINTER_KEY,
  gasBundlePointerPath,
  gasDayPointerPath,
  gasReleasePath,
  gasSeriesPath,
  gasStore,
  parsePointer,
  type GasPointer,
  type GasStoredObject,
} from "@/lib/gas/blob";
import { gasDayBounds } from "@/lib/ingest/national-gas/gas-day";
import { gasReleaseSchema, type GasComponent, type GasRelease } from "@/lib/ingest/national-gas/release";
import { GAS_METRICS, type GasMetricId } from "@/lib/metrics";
import { getRedis } from "@/lib/redis-cache";

export const GAS_INTRADAY_STALE_MS = 3 * 60 * 60 * 1000;

export type GasSeriesPoint = {
  applicable_at: string;
  published_at: string;
  gas_day: string;
  value: number | null;
};

export type CountedDayTotal = {
  publication_id: string;
  metric_id: string;
  unit: string;
  value: number;
  gas_day: string;
};

type LoadedRelease = {
  release: GasRelease;
  pointer: GasPointer;
};

/**
 * Publications with no row in the completed-day window. Health reads the latest
 * completed day instead of leaving the series not yet available.
 * Demand energy has no valid kWh extract, so that row is the demand volume.
 * Withdrawal has no current kWh extract, so that row is the withdrawal volume.
 */
export const GAS_COMPLETED_DAY_FALLBACK: Partial<
  Record<GasMetricId, { metricId: GasMetricId; label?: string }>
> = {
  "gas.gb_nts.demand.actual_energy": {
    metricId: "gas.gb_nts.demand.actual_volume",
    label: "NTS demand, completed day",
  },
  "gas.gb_nts.storage.injection": {
    metricId: "gas.gb_nts.offtake.storage_injection.energy",
  },
  "gas.gb_nts.storage.withdrawal": {
    metricId: "gas.gb_nts.supply.storage_withdrawal",
  },
};

export function gasMetricLabel(id: GasMetricId): string {
  switch (id) {
    case "gas.gb_nts.entry.physical.national":
      return "NTS entry, national";
    case "gas.gb_nts.entry.physical.north":
      return "NTS entry, north";
    case "gas.gb_nts.entry.physical.south":
      return "NTS entry, south";
    case "gas.gb_nts.entry.forecast":
      return "NTS entry forecast";
    case "gas.gb_nts.demand.actual_energy":
      return "NTS demand, energy";
    case "gas.gb_nts.linepack.opening_interim":
      return "Opening linepack, interim";
    case "gas.gb_nts.linepack.pclp1":
      return "Predicted closing linepack 1";
    case "gas.gb_nts.linepack.pclp2":
      return "Predicted closing linepack 2";
    case "gas.gb_nts.storage.injection":
      return "Storage injection";
    case "gas.gb_nts.storage.withdrawal":
      return "Storage withdrawal";
    case "gas.gb_nts.demand.actual_volume":
      return "NTS demand";
    case "gas.gb_nts.supply.physical_volume":
      return "NTS supply, volume";
    case "gas.gb_nts.supply.physical_energy":
      return "NTS supply, energy";
    case "gas.gb_nts.linepack.opening":
      return "Opening linepack";
    case "gas.gb_nts.linepack.closing":
      return "Closing linepack";
    case "gas.gb_nts.offtake.ldz.volume":
      return "LDZ offtake, volume";
    case "gas.gb_nts.offtake.ldz.energy":
      return "LDZ offtake, energy";
    case "gas.gb_nts.offtake.power.volume":
      return "Power offtake, volume";
    case "gas.gb_nts.offtake.power.energy":
      return "Power offtake, energy";
    case "gas.gb_nts.offtake.storage_injection.volume":
      return "Storage offtake, volume";
    case "gas.gb_nts.offtake.storage_injection.energy":
      return "Storage offtake, energy";
    case "gas.gb_nts.offtake.industrial.volume":
      return "Industrial offtake";
    case "gas.gb_nts.offtake.interconnector.volume":
      return "Interconnector offtake";
    case "gas.gb_nts.supply.storage_withdrawal":
      return "Storage withdrawal supply";
    default: {
      const exhaustive: never = id;
      return exhaustive;
    }
  }
}

/** Completed gas days are not stale. Intraday is stale once published_at is over 3 hours old. */
export function gasReadingStale(cadence: string, publishedAt: string | null, now: Date): boolean {
  if (cadence === "P1D" || publishedAt == null) {
    return false;
  }
  const published = new Date(publishedAt).getTime();
  if (Number.isNaN(published)) {
    return false;
  }
  return now.getTime() - published > GAS_INTRADAY_STALE_MS;
}

export function countedDayTotals(release: GasRelease): CountedDayTotal[] {
  const latest = new Map<string, GasComponent>();
  for (const component of release.components) {
    if (!component.counts || component.quantity_kind !== "day total" || component.value == null) {
      continue;
    }
    const previous = latest.get(component.publication_id);
    if (!previous || component.published_at >= previous.published_at) {
      latest.set(component.publication_id, component);
    }
  }
  return [...latest.values()]
    .flatMap((component) => {
      if (component.value == null) {
        return [];
      }
      return [
        {
          publication_id: component.publication_id,
          metric_id: component.metric_id,
          unit: component.unit,
          value: component.value,
          gas_day: release.gas_day.label,
        },
      ];
    })
    .sort((left, right) => left.publication_id.localeCompare(right.publication_id));
}

export function isGasMetricId(value: string): value is GasMetricId {
  return Object.prototype.hasOwnProperty.call(GAS_METRICS, value);
}

export async function loadGasRelease(gasDay: string | null): Promise<LoadedRelease | null> {
  const pointer = gasDay ? await readDayPointer(gasDay) : await readLatestPointer();
  if (!pointer) {
    return null;
  }
  const stored = await readStored(gasReleasePath(pointer.release_id), true);
  if (!stored) {
    return null;
  }
  let json: unknown;
  try {
    json = JSON.parse(stored.body);
  } catch {
    return null;
  }
  const parsed = gasReleaseSchema.safeParse(json);
  if (!parsed.success) {
    return null;
  }
  if (gasDay && parsed.data.gas_day.label !== gasDay) {
    return null;
  }
  return { release: parsed.data, pointer };
}

export async function gasOverviewResponse(gasDay: string | null): Promise<
  | { status: 200; body: Record<string, unknown> }
  | { status: 400 | 404; body: { error: string } }
> {
  if (gasDay != null && !gasDayBounds(gasDay)) {
    return { status: 400, body: { error: "gas_day must be a real YYYY-MM-DD gas day" } };
  }
  const loaded = await loadGasRelease(gasDay);
  if (!loaded) {
    return { status: 404, body: { error: "No gas release" } };
  }
  return {
    status: 200,
    body: {
      release_id: loaded.pointer.release_id,
      generated_at: loaded.pointer.generated_at,
      gas_day: loaded.release.gas_day,
      attribution: loaded.release.attribution,
      counted: countedDayTotals(loaded.release),
      release: loaded.release,
    },
  };
}

export async function gasSeriesResponse(
  metric: string | null,
  from: string | null,
  to: string | null,
): Promise<{ status: 200; body: Record<string, unknown> } | { status: 400; body: { error: string } }> {
  if (!metric || !isGasMetricId(metric)) {
    return { status: 400, body: { error: "Unknown metric" } };
  }
  const start = from ? parseBound(from, "from") : null;
  const end = to ? parseBound(to, "to") : null;
  if (!from || !to || !start || !end || start.getTime() >= end.getTime()) {
    return { status: 400, body: { error: "from and to must be a UTC instant or a gas day, with from before to" } };
  }
  const definition = GAS_METRICS[metric];
  const points = (await readSeriesPoints(metric)).filter((point) => {
    const at = new Date(point.applicable_at).getTime();
    return at >= start.getTime() && at < end.getTime();
  });
  return {
    status: 200,
    body: {
      metric,
      unit: definition.unit,
      points,
    },
  };
}

export function latestObservedComponent(releases: readonly GasRelease[], metricId: string): GasComponent | null {
  let chosen: GasComponent | null = null;
  for (const release of releases) {
    const component = latestComponent(release, metricId);
    if (!component) {
      continue;
    }
    if (
      !chosen ||
      component.applicable_at > chosen.applicable_at ||
      (component.applicable_at === chosen.applicable_at && component.published_at >= chosen.published_at)
    ) {
      chosen = component;
    }
  }
  return chosen;
}

const DAY_POINTER_LIMIT = 8;

/** Recent per-day pointers. A list failure leaves history on the bundle pointers. */
export async function loadRecentDayReleases(limit = DAY_POINTER_LIMIT): Promise<GasRelease[]> {
  let listed: Array<{ pathname: string }>;
  try {
    listed = await gasStore().list("releases/gas/days/");
  } catch {
    return [];
  }
  const labels = listed
    .map((item) => /^releases\/gas\/days\/(\d{4}-\d{2}-\d{2})\.json$/.exec(item.pathname)?.[1])
    .filter((label): label is string => label != null)
    .sort()
    .reverse()
    .slice(0, limit);
  const loaded = await Promise.all(
    labels.map(async (label) => {
      try {
        return await loadGasRelease(label);
      } catch {
        return null;
      }
    }),
  );
  return loaded.flatMap((item) => (item ? [item.release] : []));
}

export async function loadBundleReleases(): Promise<GasRelease[]> {
  const releases = await Promise.all([
    readPointedRelease(gasBundlePointerPath("intraday")),
    readPointedRelease(gasBundlePointerPath("completed-day")),
  ]);
  return releases.filter((release): release is GasRelease => release != null);
}

export function latestComponent(release: GasRelease, metricId: string): GasComponent | null {
  let chosen: GasComponent | null = null;
  for (const component of release.components) {
    if (component.metric_id !== metricId) {
      continue;
    }
    if (
      !chosen ||
      component.applicable_at > chosen.applicable_at ||
      (component.applicable_at === chosen.applicable_at && component.published_at >= chosen.published_at)
    ) {
      chosen = component;
    }
  }
  return chosen;
}

async function readLatestPointer(): Promise<GasPointer | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get<GasPointer>(GAS_POINTER_KEY);
      if (cached && typeof cached.release_id === "string" && typeof cached.generated_at === "string") {
        return { release_id: cached.release_id, generated_at: cached.generated_at };
      }
    } catch {
      // The pointer cache is optional. Blob remains the source.
    }
  }
  return readBlobPointer(GAS_LATEST_PATH);
}

async function readDayPointer(label: string): Promise<GasPointer | null> {
  return readBlobPointer(gasDayPointerPath(label));
}

async function readStored(pathname: string, cache: boolean): Promise<GasStoredObject | null> {
  return blobReadOrNull(() => gasStore().get(pathname, cache));
}

async function readBlobPointer(pathname: string): Promise<GasPointer | null> {
  const stored = await readStored(pathname, false);
  if (!stored) {
    return null;
  }
  return parsePointer(stored.body);
}

async function readPointedRelease(pathname: string): Promise<GasRelease | null> {
  const pointer = await readBlobPointer(pathname);
  if (!pointer) {
    return null;
  }
  const stored = await readStored(gasReleasePath(pointer.release_id), true);
  if (!stored) {
    return null;
  }
  let json: unknown;
  try {
    json = JSON.parse(stored.body);
  } catch {
    return null;
  }
  const parsed = gasReleaseSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

async function readSeriesPoints(metricId: string): Promise<GasSeriesPoint[]> {
  const stored = await readStored(gasSeriesPath(metricId), false);
  if (!stored) {
    return [];
  }
  try {
    const parsed = JSON.parse(stored.body) as { points?: GasSeriesPoint[] };
    if (!Array.isArray(parsed.points)) {
      return [];
    }
    return parsed.points.filter(
      (point) =>
        typeof point.applicable_at === "string" &&
        typeof point.published_at === "string" &&
        typeof point.gas_day === "string",
    );
  } catch {
    return [];
  }
}

function parseBound(value: string, edge: "from" | "to"): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const day = gasDayBounds(value);
    if (!day) {
      return null;
    }
    return new Date(edge === "from" ? day.start : day.end);
  }
  if (!isUtcInstant(value)) {
    return null;
  }
  return new Date(value);
}
