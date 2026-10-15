import { BlobNotFoundError, del, get, list, put } from "@vercel/blob";

export const GAS_LATEST_PATH = "releases/gas/latest.json";
export const GAS_PREVIOUS_PATH = "releases/gas/previous.json";
export const GAS_CATALOGUE_STAMP_PATH = "releases/gas/catalogue-hash.json";
export const GAS_CATALOGUE_RELEASES_PATH = "releases/gas/catalogue/source_releases.ndjson";
export const GAS_CATALOGUE_RUNS_PATH = "releases/gas/catalogue/ingestion_runs.ndjson";
export const GAS_POINTER_KEY = "grid:gas:latest";
export const GAS_POINTER_TTL_SECONDS = 300;

export const GAS_QUARANTINE_DAYS = 90;

export type GasPointer = {
  release_id: string;
  generated_at: string;
};

export function parsePointer(text: string): GasPointer | null {
  try {
    const parsed = JSON.parse(text) as GasPointer;
    if (typeof parsed.release_id !== "string" || typeof parsed.generated_at !== "string") {
      return null;
    }
    return { release_id: parsed.release_id, generated_at: parsed.generated_at };
  } catch {
    return null;
  }
}

export type GasStoredObject = {
  body: string;
  uploadedAt: Date;
  size: number;
};

export type GasPutOptions = {
  allowOverwrite: boolean;
  contentType: string;
  cacheControlMaxAge: number;
};

export type GasObjectStore = {
  put(pathname: string, body: string, options: GasPutOptions): Promise<void>;
  get(pathname: string, cache: boolean): Promise<GasStoredObject | null>;
  list(prefix: string): Promise<Array<{ pathname: string; uploadedAt: Date }>>;
  del(pathnames: readonly string[]): Promise<void>;
};

const IMMUTABLE_CACHE_SECONDS = 60 * 60 * 24 * 365;
const MUTABLE_CACHE_SECONDS = 60;

export function immutablePut(contentType: string): GasPutOptions {
  return { allowOverwrite: false, contentType, cacheControlMaxAge: IMMUTABLE_CACHE_SECONDS };
}

export function mutablePut(contentType: string): GasPutOptions {
  return { allowOverwrite: true, contentType, cacheControlMaxAge: MUTABLE_CACHE_SECONDS };
}

export function gasReleasePath(releaseId: string): string {
  return `releases/gas/${releaseId}.json`;
}

/** Latest pointer for one bundle. `latest.json` stays the newest release of either bundle. */
export function gasBundlePointerPath(bundle: "intraday" | "completed-day"): string {
  return `releases/gas/latest/${bundle}.json`;
}

export function gasRawPath(hex: string): string {
  return `releases/gas/raw/${hex}.csv`;
}

export function gasQuarantinePath(day: string, hex: string): string {
  return `quarantine/${day}/${hex}.csv`;
}

export function gasDayPointerPath(label: string): string {
  return `releases/gas/days/${label}.json`;
}

export function gasSeriesPath(metricId: string): string {
  return `releases/gas/series/${metricId}.json`;
}

export class MemoryGasStore implements GasObjectStore {
  readonly files = new Map<string, { body: string; uploadedAt: Date }>();

  async put(pathname: string, body: string, options: GasPutOptions): Promise<void> {
    if (!options.allowOverwrite && this.files.has(pathname)) {
      throw new Error(`gas blob exists: ${pathname}`);
    }
    this.files.set(pathname, { body, uploadedAt: new Date() });
  }

  async get(pathname: string): Promise<GasStoredObject | null> {
    const hit = this.files.get(pathname);
    if (!hit) {
      return null;
    }
    return { body: hit.body, uploadedAt: hit.uploadedAt, size: Buffer.byteLength(hit.body) };
  }

  async list(prefix: string): Promise<Array<{ pathname: string; uploadedAt: Date }>> {
    return [...this.files.entries()]
      .filter(([pathname]) => pathname.startsWith(prefix))
      .map(([pathname, file]) => ({ pathname, uploadedAt: file.uploadedAt }));
  }

  async del(pathnames: readonly string[]): Promise<void> {
    for (const pathname of pathnames) {
      this.files.delete(pathname);
    }
  }
}

class VercelGasStore implements GasObjectStore {
  async put(pathname: string, body: string, options: GasPutOptions): Promise<void> {
    await put(pathname, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: options.allowOverwrite,
      contentType: options.contentType,
      cacheControlMaxAge: options.cacheControlMaxAge,
    });
  }

  async get(pathname: string, cache: boolean): Promise<GasStoredObject | null> {
    try {
      const result = await get(pathname, { access: "public", useCache: cache });
      if (!result || result.statusCode !== 200 || !result.stream) {
        return null;
      }
      const body = await new Response(result.stream).text();
      return {
        body,
        uploadedAt: result.blob.uploadedAt,
        size: result.blob.size,
      };
    } catch (error) {
      if (error instanceof BlobNotFoundError) {
        return null;
      }
      throw error;
    }
  }

  async list(prefix: string): Promise<Array<{ pathname: string; uploadedAt: Date }>> {
    const found: Array<{ pathname: string; uploadedAt: Date }> = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      for (const blob of page.blobs) {
        found.push({ pathname: blob.pathname, uploadedAt: blob.uploadedAt });
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return found;
  }

  async del(pathnames: readonly string[]): Promise<void> {
    if (pathnames.length === 0) {
      return;
    }
    await del([...pathnames]);
  }
}

const disabledStore: GasObjectStore = {
  async put() {
    throw new Error("gas blob store is not set");
  },
  async get() {
    return null;
  },
  async list() {
    return [];
  },
  async del() {
    return undefined;
  },
};

let override: GasObjectStore | null = null;
let production: GasObjectStore | null = null;

export function setGasStoreForTests(store: GasObjectStore | null): void {
  override = store;
}

export function gasStore(): GasObjectStore {
  if (override) {
    return override;
  }
  if (process.env.VITEST) {
    return disabledStore;
  }
  production ??= new VercelGasStore();
  return production;
}
