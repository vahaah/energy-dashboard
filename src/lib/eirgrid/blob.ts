import { del, get, put } from "@vercel/blob";
import { readBlobResponse } from "@/lib/blob-read";

export const NI_LATEST_PATH = "releases/eirgrid-ni/latest.json";
export const NI_PREVIOUS_PATH = "releases/eirgrid-ni/previous.json";
export const NI_CATALOGUE_RELEASES_PATH = "releases/eirgrid-ni/catalogue/source_releases.ndjson";
export const NI_CATALOGUE_RUNS_PATH = "releases/eirgrid-ni/catalogue/ingestion_runs.ndjson";

export type NiPointer = {
  release_id: string;
  generated_at: string;
};

export function parseNiPointer(text: string): NiPointer | null {
  try {
    const parsed = JSON.parse(text) as NiPointer;
    if (typeof parsed.release_id !== "string" || typeof parsed.generated_at !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function niReleasePath(releaseId: string): string {
  return `releases/eirgrid-ni/${releaseId}.json`;
}

export function niRawPath(hex: string): string {
  return `releases/eirgrid-ni/raw/${hex}.json`;
}

export type NiPutOptions = {
  allowOverwrite: boolean;
  contentType: string;
  cacheControlMaxAge: number;
};

export type NiObjectStore = {
  put(pathname: string, body: string, options: NiPutOptions): Promise<void>;
  get(pathname: string, cache: boolean): Promise<{ body: string; uploadedAt: Date; size: number } | null>;
  del(pathnames: readonly string[]): Promise<void>;
};

const IMMUTABLE_CACHE_SECONDS = 60 * 60 * 24 * 365;
const MUTABLE_CACHE_SECONDS = 60;

export function niImmutablePut(contentType: string): NiPutOptions {
  return { allowOverwrite: false, contentType, cacheControlMaxAge: IMMUTABLE_CACHE_SECONDS };
}

export function niMutablePut(contentType: string): NiPutOptions {
  return { allowOverwrite: true, contentType, cacheControlMaxAge: MUTABLE_CACHE_SECONDS };
}

export class MemoryNiStore implements NiObjectStore {
  readonly files = new Map<string, { body: string; uploadedAt: Date }>();

  async put(pathname: string, body: string, options: NiPutOptions): Promise<void> {
    if (!options.allowOverwrite && this.files.has(pathname)) {
      throw new Error(`eirgrid blob exists: ${pathname}`);
    }
    this.files.set(pathname, { body, uploadedAt: new Date() });
  }

  async get(pathname: string): Promise<{ body: string; uploadedAt: Date; size: number } | null> {
    const hit = this.files.get(pathname);
    if (!hit) {
      return null;
    }
    return { body: hit.body, uploadedAt: hit.uploadedAt, size: Buffer.byteLength(hit.body) };
  }

  async del(pathnames: readonly string[]): Promise<void> {
    for (const pathname of pathnames) {
      this.files.delete(pathname);
    }
  }
}

class VercelNiStore implements NiObjectStore {
  async put(pathname: string, body: string, options: NiPutOptions): Promise<void> {
    await put(pathname, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: options.allowOverwrite,
      contentType: options.contentType,
      cacheControlMaxAge: options.cacheControlMaxAge,
    });
  }

  async get(pathname: string, cache: boolean): Promise<{ body: string; uploadedAt: Date; size: number } | null> {
    return readBlobResponse(() => get(pathname, { access: "public", useCache: cache }));
  }

  async del(pathnames: readonly string[]): Promise<void> {
    if (pathnames.length === 0) {
      return;
    }
    await del([...pathnames]);
  }
}

const disabledStore: NiObjectStore = {
  async put() {
    throw new Error("eirgrid blob store is not set");
  },
  async get() {
    return null;
  },
  async del() {
    return undefined;
  },
};

let override: NiObjectStore | null = null;
let production: NiObjectStore | null = null;

export function setNiStoreForTests(store: NiObjectStore | null): void {
  override = store;
}

export function niStore(): NiObjectStore {
  if (override) {
    return override;
  }
  if (process.env.VITEST) {
    return disabledStore;
  }
  production ??= new VercelNiStore();
  return production;
}
