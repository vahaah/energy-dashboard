import { BlobNotFoundError, del, get, list, put } from "@vercel/blob";

export const CONSTRAINTS_LATEST_PATH = "releases/neso-constraints/latest.json";
export const CONSTRAINTS_PREVIOUS_PATH = "releases/neso-constraints/previous.json";
export const CONSTRAINTS_CATALOGUE_RELEASES_PATH = "releases/neso-constraints/catalogue/source_releases.ndjson";
export const CONSTRAINTS_CATALOGUE_RUNS_PATH = "releases/neso-constraints/catalogue/ingestion_runs.ndjson";
export const CONSTRAINTS_QUARANTINE_DAYS = 90;

export type ConstraintsPointer = {
  release_id: string;
  bundle: "breakdown" | "day-ahead";
  generated_at: string;
};

export function parseConstraintsPointer(text: string): ConstraintsPointer | null {
  try {
    const parsed = JSON.parse(text) as ConstraintsPointer;
    if (parsed.bundle !== "breakdown" && parsed.bundle !== "day-ahead") {
      return null;
    }
    if (typeof parsed.release_id !== "string" || typeof parsed.generated_at !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export type ConstraintsStoredObject = {
  body: string;
  uploadedAt: Date;
  size: number;
};

export type ConstraintsPutOptions = {
  allowOverwrite: boolean;
  contentType: string;
  cacheControlMaxAge: number;
};

export type ConstraintsObjectStore = {
  put(pathname: string, body: string, options: ConstraintsPutOptions): Promise<void>;
  get(pathname: string, cache: boolean): Promise<ConstraintsStoredObject | null>;
  list(prefix: string): Promise<Array<{ pathname: string; uploadedAt: Date }>>;
  del(pathnames: readonly string[]): Promise<void>;
};

const IMMUTABLE_CACHE_SECONDS = 60 * 60 * 24 * 365;
const MUTABLE_CACHE_SECONDS = 60;

export function constraintsImmutablePut(contentType: string): ConstraintsPutOptions {
  return { allowOverwrite: false, contentType, cacheControlMaxAge: IMMUTABLE_CACHE_SECONDS };
}

export function constraintsMutablePut(contentType: string): ConstraintsPutOptions {
  return { allowOverwrite: true, contentType, cacheControlMaxAge: MUTABLE_CACHE_SECONDS };
}

export function constraintsReleasePath(releaseId: string): string {
  return `releases/neso-constraints/${releaseId}.json`;
}

export function constraintsBundlePointerPath(bundle: "breakdown" | "day-ahead"): string {
  return `releases/neso-constraints/latest/${bundle}.json`;
}

export function constraintsBundlePreviousPath(bundle: "breakdown" | "day-ahead"): string {
  return `releases/neso-constraints/previous/${bundle}.json`;
}

export function constraintsRawPath(hex: string): string {
  return `releases/neso-constraints/raw/${hex}.csv`;
}

export function constraintsMetaPath(hex: string): string {
  return `releases/neso-constraints/raw/${hex}.meta.json`;
}

export function constraintsQuarantinePath(day: string, hex: string): string {
  return `quarantine/neso-constraints/${day}/${hex}.csv`;
}

export class MemoryConstraintsStore implements ConstraintsObjectStore {
  readonly files = new Map<string, { body: string; uploadedAt: Date }>();

  async put(pathname: string, body: string, options: ConstraintsPutOptions): Promise<void> {
    if (!options.allowOverwrite && this.files.has(pathname)) {
      throw new Error(`constraints blob exists: ${pathname}`);
    }
    this.files.set(pathname, { body, uploadedAt: new Date() });
  }

  async get(pathname: string): Promise<ConstraintsStoredObject | null> {
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

class VercelConstraintsStore implements ConstraintsObjectStore {
  async put(pathname: string, body: string, options: ConstraintsPutOptions): Promise<void> {
    await put(pathname, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: options.allowOverwrite,
      contentType: options.contentType,
      cacheControlMaxAge: options.cacheControlMaxAge,
    });
  }

  async get(pathname: string, cache: boolean): Promise<ConstraintsStoredObject | null> {
    try {
      const result = await get(pathname, { access: "public", useCache: cache });
      if (!result || result.statusCode !== 200 || !result.stream) {
        return null;
      }
      const body = await new Response(result.stream).text();
      return { body, uploadedAt: result.blob.uploadedAt, size: result.blob.size };
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

const disabledStore: ConstraintsObjectStore = {
  async put() {
    throw new Error("constraints blob store is not set");
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

let override: ConstraintsObjectStore | null = null;
let production: ConstraintsObjectStore | null = null;

export function setConstraintsStoreForTests(store: ConstraintsObjectStore | null): void {
  override = store;
}

export function constraintsStore(): ConstraintsObjectStore {
  if (override) {
    return override;
  }
  if (process.env.VITEST) {
    return disabledStore;
  }
  production ??= new VercelConstraintsStore();
  return production;
}
