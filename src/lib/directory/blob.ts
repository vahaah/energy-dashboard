import { get, put } from "@vercel/blob";
import { blobReadSignal, readBlobResponse } from "@/lib/blob-read";

export const DIRECTORY_LATEST_PATH = "releases/directory/latest.json";
export const DIRECTORY_PREVIOUS_PATH = "releases/directory/previous.json";

export type DirectoryPutOptions = {
  allowOverwrite: boolean;
  contentType: string;
  cacheControlMaxAge: number;
};

export type DirectoryStoredObject = {
  body: string;
  uploadedAt: Date;
  size: number;
};

export type DirectoryObjectStore = {
  put(pathname: string, body: string, options: DirectoryPutOptions): Promise<void>;
  get(pathname: string): Promise<DirectoryStoredObject | null>;
};

const IMMUTABLE_CACHE_SECONDS = 60 * 60 * 24 * 365;
const MUTABLE_CACHE_SECONDS = 60;

/** ISD lookup snapshots are not a public download. The API is the read path. */
export const DIRECTORY_BLOB_ACCESS = "private" as const;

/** The tiles store is public and rejects private blobs. This store is private. */
export const DIRECTORY_BLOB_STORE_ENV = "DIRECTORY_BLOB_STORE_ID";
export const DIRECTORY_BLOB_TOKEN_ENV = "DIRECTORY_BLOB_READ_WRITE_TOKEN";

export function directoryBlobCommand(): { token?: string; storeId?: string } | null {
  const token = process.env[DIRECTORY_BLOB_TOKEN_ENV]?.trim();
  if (token) {
    return { token };
  }
  const storeId = process.env[DIRECTORY_BLOB_STORE_ENV]?.trim();
  if (storeId) {
    return { storeId };
  }
  return null;
}

export function directoryBlobWriteOptions(options: DirectoryPutOptions): {
  access: typeof DIRECTORY_BLOB_ACCESS;
  addRandomSuffix: false;
  allowOverwrite: boolean;
  contentType: string;
  cacheControlMaxAge: number;
} {
  return {
    access: DIRECTORY_BLOB_ACCESS,
    addRandomSuffix: false,
    allowOverwrite: options.allowOverwrite,
    contentType: options.contentType,
    cacheControlMaxAge: options.cacheControlMaxAge,
  };
}

export function directoryImmutablePut(): DirectoryPutOptions {
  return {
    allowOverwrite: false,
    contentType: "application/json",
    cacheControlMaxAge: IMMUTABLE_CACHE_SECONDS,
  };
}

export function directoryMutablePut(): DirectoryPutOptions {
  return {
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: MUTABLE_CACHE_SECONDS,
  };
}

export function directoryReleasePath(contentHash: string): string {
  const hex = contentHash.startsWith("sha256:") ? contentHash.slice("sha256:".length) : contentHash;
  return `releases/directory/${hex}.json`;
}

export class MemoryDirectoryStore implements DirectoryObjectStore {
  readonly files = new Map<string, { body: string; uploadedAt: Date }>();

  async put(pathname: string, body: string, options: DirectoryPutOptions): Promise<void> {
    if (!options.allowOverwrite && this.files.has(pathname)) {
      throw new Error(`directory blob exists: ${pathname}`);
    }
    this.files.set(pathname, { body, uploadedAt: new Date() });
  }

  async get(pathname: string): Promise<DirectoryStoredObject | null> {
    const hit = this.files.get(pathname);
    if (!hit) {
      return null;
    }
    return { body: hit.body, uploadedAt: hit.uploadedAt, size: Buffer.byteLength(hit.body) };
  }
}

class VercelDirectoryStore implements DirectoryObjectStore {
  async put(pathname: string, body: string, options: DirectoryPutOptions): Promise<void> {
    const auth = directoryBlobCommand();
    if (!auth) {
      throw new Error("directory blob store is not set");
    }
    await put(pathname, body, { ...directoryBlobWriteOptions(options), ...auth });
  }

  async get(pathname: string): Promise<DirectoryStoredObject | null> {
    const auth = directoryBlobCommand();
    if (!auth) {
      return null;
    }
    return readBlobResponse(() =>
      get(pathname, { access: DIRECTORY_BLOB_ACCESS, useCache: true, abortSignal: blobReadSignal(), ...auth }),
    );
  }
}

const disabledStore: DirectoryObjectStore = {
  async put() {
    throw new Error("directory blob store is not set");
  },
  async get() {
    return null;
  },
};

let override: DirectoryObjectStore | null = null;
let production: DirectoryObjectStore | null = null;

export function setDirectoryStoreForTests(store: DirectoryObjectStore | null): void {
  override = store;
}

export function directoryStore(): DirectoryObjectStore {
  if (override) {
    return override;
  }
  if (process.env.VITEST || !directoryBlobCommand()) {
    return disabledStore;
  }
  production ??= new VercelDirectoryStore();
  return production;
}
