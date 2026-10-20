import { createHash } from "node:crypto";
import { get, put } from "@vercel/blob";
import { blobReadSignal, readBlobResponse } from "@/lib/blob-read";

export const POSTCODE_LATEST_PATH = "releases/postcodes/latest.json";
export const POSTCODE_PREVIOUS_PATH = "releases/postcodes/previous.json";

export type PostcodePointer = {
  release_id: string;
  generated_at: string;
};

export type PostcodePutOptions = {
  allowOverwrite: boolean;
  contentType: string;
  cacheControlMaxAge: number;
};

export type PostcodeStoredObject = {
  body: string;
  uploadedAt: Date;
  size: number;
};

export type PostcodeObjectStore = {
  put(pathname: string, body: string, options: PostcodePutOptions): Promise<void>;
  get(pathname: string): Promise<PostcodeStoredObject | null>;
};

const IMMUTABLE_CACHE_SECONDS = 60 * 60 * 24 * 365;
const MUTABLE_CACHE_SECONDS = 60;

/** The lookup is not a public download of the ONS file. The API is the read path. */
export const POSTCODE_BLOB_ACCESS = "private" as const;

export function postcodeBlobWriteOptions(options: PostcodePutOptions): {
  access: typeof POSTCODE_BLOB_ACCESS;
  addRandomSuffix: false;
  allowOverwrite: boolean;
  contentType: string;
  cacheControlMaxAge: number;
} {
  return {
    access: POSTCODE_BLOB_ACCESS,
    addRandomSuffix: false,
    allowOverwrite: options.allowOverwrite,
    contentType: options.contentType,
    cacheControlMaxAge: options.cacheControlMaxAge,
  };
}

export function postcodeImmutablePut(): PostcodePutOptions {
  return {
    allowOverwrite: false,
    contentType: "application/json",
    cacheControlMaxAge: IMMUTABLE_CACHE_SECONDS,
  };
}

export function postcodeMutablePut(): PostcodePutOptions {
  return {
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: MUTABLE_CACHE_SECONDS,
  };
}

function safeRelease(releaseId: string): string {
  return releaseId.replace(/[^A-Za-z0-9._-]+/g, "_");
}

/**
 * Shard path. The outward code is hashed, so neither it nor the inward code
 * is a blob key.
 */
export function postcodeShardPath(releaseId: string, outward: string): string {
  const shard = createHash("sha256").update(outward).digest("hex");
  return `releases/postcodes/${safeRelease(releaseId)}/${shard}.json`;
}

export function parsePostcodePointer(text: string): PostcodePointer | null {
  try {
    const parsed = JSON.parse(text) as PostcodePointer;
    if (typeof parsed.release_id !== "string" || typeof parsed.generated_at !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export class MemoryPostcodeStore implements PostcodeObjectStore {
  readonly files = new Map<string, { body: string; uploadedAt: Date }>();

  async put(pathname: string, body: string, options: PostcodePutOptions): Promise<void> {
    if (!options.allowOverwrite && this.files.has(pathname)) {
      throw new Error(`postcode blob exists: ${pathname}`);
    }
    this.files.set(pathname, { body, uploadedAt: new Date() });
  }

  async get(pathname: string): Promise<PostcodeStoredObject | null> {
    const hit = this.files.get(pathname);
    if (!hit) {
      return null;
    }
    return { body: hit.body, uploadedAt: hit.uploadedAt, size: Buffer.byteLength(hit.body) };
  }
}

class VercelPostcodeStore implements PostcodeObjectStore {
  async put(pathname: string, body: string, options: PostcodePutOptions): Promise<void> {
    await put(pathname, body, postcodeBlobWriteOptions(options));
  }

  async get(pathname: string): Promise<PostcodeStoredObject | null> {
    return readBlobResponse(() =>
      get(pathname, { access: POSTCODE_BLOB_ACCESS, useCache: true, abortSignal: blobReadSignal() }),
    );
  }
}

const disabledStore: PostcodeObjectStore = {
  async put() {
    throw new Error("postcode blob store is not set");
  },
  async get() {
    return null;
  },
};

let override: PostcodeObjectStore | null = null;
let production: PostcodeObjectStore | null = null;

export function setPostcodeStoreForTests(store: PostcodeObjectStore | null): void {
  override = store;
}

export function postcodeStore(): PostcodeObjectStore {
  if (override) {
    return override;
  }
  if (process.env.VITEST || !process.env.BLOB_READ_WRITE_TOKEN) {
    return disabledStore;
  }
  production ??= new VercelPostcodeStore();
  return production;
}
