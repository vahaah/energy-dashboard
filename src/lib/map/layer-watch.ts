import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { layerWatchFileSchema, layersFileSchema, type MapLayer } from "@/lib/catalogue/layers";
import { DNO_LAYER_ID, NESO_DNO_PACKAGE_URL, REDIS_DNO_POINTER_KEY } from "@/lib/map/constants";
import { parseLayerPointer, type LayerPointer } from "@/lib/map/layer-flag";
import { getRedis, type RedisCommands } from "@/lib/redis-cache";

const USER_AGENT = "grid-catalogue/1.0 (energy-dashboard; DNO layer watch)";

export type SourceObservation = {
  sourceUrl: string;
  etag: string | null;
  sha256: string | null;
  downloaded: boolean;
};

export type WatchDecision = {
  action: "keep" | "flag";
  pointer: LayerPointer;
  downloaded: boolean;
};

export type WatchRun = {
  ok: boolean;
  status: "current" | "changed" | "failed";
  persisted: boolean;
  downloaded: boolean;
  edition: string | null;
  published_sha256: string | null;
  source_sha256: string | null;
  error?: string;
};

type CkanResource = {
  format?: string;
  name?: string;
  url?: string;
  last_modified?: string | null;
};

const ckanPackageSchema = z
  .object({
    success: z.literal(true),
    result: z
      .object({
        resources: z.array(
          z
            .object({
              format: z.string().optional(),
              name: z.string().optional(),
              url: z.string().optional(),
              last_modified: z.string().nullable().optional(),
            })
            .passthrough(),
        ),
      })
      .passthrough(),
  })
  .passthrough();

export function normalizeEtag(etag: string): string {
  return etag.trim().replace(/^W\//, "").replaceAll('"', "");
}

function editionNumber(resource: CkanResource): number {
  const match = /(\d{8})/.exec(`${resource.name ?? ""} ${resource.url ?? ""}`);
  return match?.[1] ? Number(match[1]) : 0;
}

function modifiedNumber(resource: CkanResource): number {
  const parsed = Date.parse(resource.last_modified ?? "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Latest GeoJSON resource on the NESO DNO package. */
export function selectDnoGeoJsonResource(resources: readonly CkanResource[]): CkanResource {
  const geo = resources.filter((resource) => {
    const format = (resource.format ?? "").toLowerCase();
    const name = (resource.name ?? "").toLowerCase();
    const url = (resource.url ?? "").toLowerCase();
    return format === "geojson" || name.includes("geojson") || url.endsWith(".geojson");
  });
  const ranked = [...geo].sort((left, right) => {
    const edition = editionNumber(right) - editionNumber(left);
    if (edition !== 0) {
      return edition;
    }
    return modifiedNumber(right) - modifiedNumber(left);
  });
  const selected = ranked[0];
  if (!selected?.url || !selected.url.startsWith("https://")) {
    throw new Error("NESO package has no GeoJSON resource");
  }
  return selected;
}

export function editionFromResource(resource: CkanResource): string {
  const edition = editionNumber(resource);
  if (edition === 0) {
    throw new Error("NESO GeoJSON resource has no edition date");
  }
  return String(edition);
}

/**
 * Source observation from the last successful check, with the checked-in
 * publication fields kept. A pointer for another layer is ignored.
 */
export function watchBaseline(published: LayerPointer, persisted: LayerPointer | null): LayerPointer {
  if (!persisted || persisted.layer_id !== published.layer_id) {
    return published;
  }
  return {
    ...published,
    source_url: persisted.source_url,
    source_etag: persisted.source_etag,
    source_sha256: persisted.source_sha256,
    status: persisted.status,
    checked_at: persisted.checked_at,
  };
}

/**
 * `baseline` is the source ETag and source hash to probe against. Its
 * edition, file URL, bytes, and sha256 are the checked-in publication.
 * `publishedSourceSha256` is the checked-in source hash. A download with that
 * hash is current even when NESO serves it from a new URL. An ETag match
 * counts only for the same URL, and a conditional hit stays changed when the
 * stored source hash is not the checked-in one.
 */
export function decideLayerWatch(
  baseline: LayerPointer,
  observation: SourceObservation,
  checkedAt: string,
  publishedSourceSha256: string = baseline.source_sha256,
): WatchDecision {
  const sameUrl = observation.sourceUrl === baseline.source_url;
  const etagMatches =
    sameUrl &&
    !observation.downloaded &&
    observation.etag !== null &&
    baseline.source_etag !== null &&
    normalizeEtag(observation.etag) === normalizeEtag(baseline.source_etag);
  const shaMatches = observation.sha256 !== null && observation.sha256 === publishedSourceSha256;
  if (!observation.downloaded && !etagMatches && observation.sha256 === null) {
    throw new Error("NESO source was not downloaded and did not match the stored ETag");
  }
  const sourceMatchesPublished = shaMatches || (etagMatches && baseline.source_sha256 === publishedSourceSha256);
  if (etagMatches || shaMatches) {
    const status = sourceMatchesPublished ? "current" : "changed";
    return {
      action: status === "current" ? "keep" : "flag",
      downloaded: observation.downloaded,
      pointer: {
        ...baseline,
        source_url: shaMatches && observation.sourceUrl ? observation.sourceUrl : baseline.source_url,
        source_etag: observation.etag ?? baseline.source_etag,
        source_sha256: shaMatches && observation.sha256 ? observation.sha256 : baseline.source_sha256,
        status,
        checked_at: checkedAt,
      },
    };
  }
  if (observation.sha256 === null) {
    throw new Error("NESO source changed and no sha256 was computed");
  }
  return {
    action: "flag",
    downloaded: true,
    pointer: {
      ...baseline,
      source_url: observation.sourceUrl,
      source_etag: observation.etag,
      source_sha256: observation.sha256,
      status: "changed",
      checked_at: checkedAt,
    },
  };
}

function redact(message: string): string {
  return message
    .replace(/https?:\/\/\S*X-Amz-[A-Za-z-]+=\S*/g, "[signed-url]")
    .replace(/https?:\/\/\S*r2\.cloudflarestorage\.com\S*/g, "[signed-url]");
}

async function sha256Body(response: Response): Promise<string> {
  if (!response.body) {
    throw new Error("NESO source returned an empty body");
  }
  const hash = createHash("sha256");
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      hash.update(value);
    }
  }
  return `sha256:${hash.digest("hex")}`;
}

async function readPayload(
  response: Response,
  previousEtag: string | null,
): Promise<{ etag: string | null; sha256: string | null; downloaded: boolean }> {
  if (response.status === 304) {
    return { etag: previousEtag, sha256: null, downloaded: false };
  }
  if (!response.ok) {
    throw new Error(`NESO source returned ${response.status}`);
  }
  const etag = response.headers.get("etag");
  if (etag && previousEtag && normalizeEtag(etag) === normalizeEtag(previousEtag)) {
    await response.body?.cancel();
    return { etag, sha256: null, downloaded: false };
  }
  const sha256 = await sha256Body(response);
  return { etag, sha256, downloaded: true };
}

export async function probeDnoSource(
  sourceUrl: string,
  previousEtag: string | null,
  fetchImpl: typeof fetch,
): Promise<{ etag: string | null; sha256: string | null; downloaded: boolean }> {
  if (!sourceUrl.startsWith("https://api.neso.energy/")) {
    throw new Error("DNO source URL must be on api.neso.energy");
  }
  const first = await fetchImpl(sourceUrl, {
    redirect: "manual",
    headers: { "user-agent": USER_AGENT, accept: "application/geo+json, application/json;q=0.9, */*;q=0.8" },
  });
  if (first.status >= 300 && first.status < 400) {
    const location = first.headers.get("location");
    if (!location || !location.startsWith("https://")) {
      throw new Error("NESO download redirect was not https");
    }
    const headers = new Headers({ "user-agent": USER_AGENT });
    if (previousEtag) {
      headers.set("if-none-match", previousEtag);
    }
    const file = await fetchImpl(location, { headers, redirect: "error" });
    return readPayload(file, previousEtag);
  }
  return readPayload(first, previousEtag);
}

function readCatalogue(): { layer: MapLayer; watchSourceUrl: string; watchEtag: string | null; watchSha: string; watchChecked: string } {
  const layers = layersFileSchema.parse(
    JSON.parse(readFileSync(join(process.cwd(), "data", "catalogue", "layers.json"), "utf8")),
  );
  const watch = layerWatchFileSchema.parse(
    JSON.parse(readFileSync(join(process.cwd(), "data", "catalogue", "layer_watch.json"), "utf8")),
  );
  const layer = layers.find((entry) => entry.id === DNO_LAYER_ID);
  const entry = watch.layers.find((item) => item.id === DNO_LAYER_ID);
  if (!layer || !entry) {
    throw new Error("DNO layer catalogue is missing");
  }
  return {
    layer,
    watchSourceUrl: entry.source_url,
    watchEtag: entry.source_etag,
    watchSha: entry.source_sha256,
    watchChecked: entry.checked_at,
  };
}

function seedPointer(catalogue: ReturnType<typeof readCatalogue>): LayerPointer {
  return {
    layer_id: catalogue.layer.id,
    edition: catalogue.layer.edition,
    url: catalogue.layer.url,
    sha256: catalogue.layer.sha256,
    bytes: catalogue.layer.bytes,
    source_url: catalogue.watchSourceUrl,
    source_etag: catalogue.watchEtag,
    source_sha256: catalogue.watchSha,
    status: "current",
    checked_at: catalogue.watchChecked,
  };
}

function failed(error: string, previous: LayerPointer | null): WatchRun {
  return {
    ok: false,
    status: "failed",
    persisted: false,
    downloaded: false,
    edition: previous?.edition ?? null,
    published_sha256: previous?.sha256 ?? null,
    source_sha256: previous?.source_sha256 ?? null,
    error,
  };
}

export async function runDnoLayerWatch(options: {
  now?: Date;
  fetchImpl?: typeof fetch;
  redis?: RedisCommands | null;
} = {}): Promise<WatchRun> {
  const now = options.now ?? new Date();
  const fetchImpl = options.fetchImpl ?? fetch;
  const redis = options.redis === undefined ? getRedis() : options.redis;
  let previous: LayerPointer | null = null;
  try {
    const catalogue = readCatalogue();
    const published = seedPointer(catalogue);
    previous = published;
    let persistedPointer: LayerPointer | null = null;
    if (redis) {
      try {
        persistedPointer = parseLayerPointer(await redis.get(REDIS_DNO_POINTER_KEY));
      } catch (error) {
        return failed(redact(error instanceof Error ? error.message : String(error)), published);
      }
    }
    const baseline = watchBaseline(published, persistedPointer);
    previous = baseline;
    const packageResponse = await fetchImpl(NESO_DNO_PACKAGE_URL, {
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
    });
    if (!packageResponse.ok) {
      return failed(`NESO package returned ${packageResponse.status}`, baseline);
    }
    const resource = selectDnoGeoJsonResource(
      ckanPackageSchema.parse(await packageResponse.json()).result.resources,
    );
    const probed = await probeDnoSource(resource.url ?? "", baseline.source_etag, fetchImpl);
    const decision = decideLayerWatch(
      baseline,
      { sourceUrl: resource.url ?? "", etag: probed.etag, sha256: probed.sha256, downloaded: probed.downloaded },
      now.toISOString(),
      published.source_sha256,
    );
    let persisted = false;
    if (redis) {
      const wrote = await redis.set(REDIS_DNO_POINTER_KEY, JSON.stringify(decision.pointer));
      persisted = wrote === "OK";
      if (!persisted) {
        return failed("pointer write did not succeed", baseline);
      }
    }
    const status = decision.pointer.status;
    return {
      ok: true,
      status,
      persisted,
      downloaded: decision.downloaded,
      edition: decision.pointer.edition,
      published_sha256: decision.pointer.sha256,
      source_sha256: decision.pointer.source_sha256,
    };
  } catch (error) {
    return failed(redact(error instanceof Error ? error.message : String(error)), previous);
  }
}
