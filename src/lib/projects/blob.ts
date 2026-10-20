import { del, get, list, put } from "@vercel/blob";
import { readBlobResponse, withBlobReadRetry } from "@/lib/blob-read";

export const TEC_LATEST_PATH = "releases/tec/latest.json";
export const TEC_PREVIOUS_PATH = "releases/tec/previous.json";
export const TEC_CATALOGUE_RELEASES_PATH = "releases/tec/catalogue/source_releases.ndjson";
export const TEC_CATALOGUE_RUNS_PATH = "releases/tec/catalogue/ingestion_runs.ndjson";
export const TEC_QUARANTINE_DAYS = 90;

export type TecPointer = {
  release_id: string;
  generated_at: string;
};

export function parseTecPointer(text: string): TecPointer | null {
  try {
    const parsed = JSON.parse(text) as TecPointer;
    if (typeof parsed.release_id !== "string" || typeof parsed.generated_at !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export type TecStoredObject = {
  body: string;
  uploadedAt: Date;
  size: number;
};

export type TecPutOptions = {
  allowOverwrite: boolean;
  contentType: string;
  cacheControlMaxAge: number;
};

export type TecObjectStore = {
  put(pathname: string, body: string, options: TecPutOptions): Promise<void>;
  get(pathname: string, cache: boolean): Promise<TecStoredObject | null>;
  list(prefix: string): Promise<Array<{ pathname: string; uploadedAt: Date }>>;
  del(pathnames: readonly string[]): Promise<void>;
};

const IMMUTABLE_CACHE_SECONDS = 60 * 60 * 24 * 365;
const MUTABLE_CACHE_SECONDS = 60;

export function tecImmutablePut(contentType: string): TecPutOptions {
  return { allowOverwrite: false, contentType, cacheControlMaxAge: IMMUTABLE_CACHE_SECONDS };
}

export function tecMutablePut(contentType: string): TecPutOptions {
  return { allowOverwrite: true, contentType, cacheControlMaxAge: MUTABLE_CACHE_SECONDS };
}

export function tecReleasePath(releaseId: string): string {
  return `releases/tec/${releaseId}.json`;
}

export function tecRawPath(hex: string): string {
  return `releases/tec/raw/${hex}.csv`;
}

export function tecMetaPath(hex: string): string {
  return `releases/tec/raw/${hex}.meta.json`;
}

export function tecQuarantinePath(day: string, hex: string): string {
  return `quarantine/tec/${day}/${hex}.csv`;
}

export class MemoryTecStore implements TecObjectStore {
  readonly files = new Map<string, { body: string; uploadedAt: Date }>();

  async put(pathname: string, body: string, options: TecPutOptions): Promise<void> {
    if (!options.allowOverwrite && this.files.has(pathname)) {
      throw new Error(`tec blob exists: ${pathname}`);
    }
    this.files.set(pathname, { body, uploadedAt: new Date() });
  }

  async get(pathname: string): Promise<TecStoredObject | null> {
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

class VercelTecStore implements TecObjectStore {
  async put(pathname: string, body: string, options: TecPutOptions): Promise<void> {
    await put(pathname, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: options.allowOverwrite,
      contentType: options.contentType,
      cacheControlMaxAge: options.cacheControlMaxAge,
    });
  }

  async get(pathname: string, cache: boolean): Promise<TecStoredObject | null> {
    return readBlobResponse(() => get(pathname, { access: "public", useCache: cache }));
  }

  async list(prefix: string): Promise<Array<{ pathname: string; uploadedAt: Date }>> {
    const found: Array<{ pathname: string; uploadedAt: Date }> = [];
    let cursor: string | undefined;
    do {
      const page = await withBlobReadRetry(() => list({ prefix, cursor, limit: 1000 }));
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

const disabledStore: TecObjectStore = {
  async put() {
    throw new Error("tec blob store is not set");
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

let override: TecObjectStore | null = null;
let production: TecObjectStore | null = null;

export function setTecStoreForTests(store: TecObjectStore | null): void {
  override = store;
}

export function tecStore(): TecObjectStore {
  if (override) {
    return override;
  }
  if (process.env.VITEST) {
    return disabledStore;
  }
  production ??= new VercelTecStore();
  return production;
}
