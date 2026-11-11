import { createHash } from "node:crypto";
import { get, put } from "@vercel/blob";
import { blobReadSignal, readBlobResponse } from "@/lib/blob-read";

export const BALANCING_LATEST_PATH = "releases/balancing/latest.json";
export const BALANCING_PREVIOUS_PATH = "releases/balancing/previous.json";

export type BalancingPointer = {
  release_id: string;
  generated_at: string;
};

export function parseBalancingPointer(text: string): BalancingPointer | null {
  try {
    const parsed = JSON.parse(text) as BalancingPointer;
    if (typeof parsed.release_id !== "string" || typeof parsed.generated_at !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function balancingReleaseId(body: string): string {
  const hex = createHash("sha256").update(body).digest("hex");
  return `balancing-${hex.slice(0, 24)}`;
}

export function balancingReleasePath(releaseId: string): string {
  return `releases/balancing/${releaseId}.json`;
}

type PutOptions = {
  allowOverwrite: boolean;
  contentType: string;
  cacheControlMaxAge: number;
};

export type BalancingObjectStore = {
  put(pathname: string, body: string, options: PutOptions): Promise<void>;
  get(pathname: string, cache: boolean): Promise<{ body: string; size: number } | null>;
};

const IMMUTABLE_CACHE_SECONDS = 60 * 60 * 24 * 365;
const MUTABLE_CACHE_SECONDS = 60;

export function immutablePut(contentType: string): PutOptions {
  return { allowOverwrite: false, contentType, cacheControlMaxAge: IMMUTABLE_CACHE_SECONDS };
}

export function mutablePut(contentType: string): PutOptions {
  return { allowOverwrite: true, contentType, cacheControlMaxAge: MUTABLE_CACHE_SECONDS };
}

class VercelBalancingStore implements BalancingObjectStore {
  async put(pathname: string, body: string, options: PutOptions): Promise<void> {
    await put(pathname, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: options.allowOverwrite,
      contentType: options.contentType,
      cacheControlMaxAge: options.cacheControlMaxAge,
    });
  }

  async get(pathname: string, cache: boolean): Promise<{ body: string; size: number } | null> {
    const stored = await readBlobResponse(() =>
      get(pathname, { access: "public", useCache: cache, abortSignal: blobReadSignal() }),
    );
    if (!stored) {
      return null;
    }
    return { body: stored.body, size: stored.size };
  }
}

const disabledStore: BalancingObjectStore = {
  async put() {
    throw new Error("balancing blob store is not set");
  },
  async get() {
    return null;
  },
};

let production: BalancingObjectStore | null = null;

export function balancingStore(): BalancingObjectStore {
  if (process.env.VITEST || !process.env.BLOB_READ_WRITE_TOKEN) {
    return disabledStore;
  }
  production ??= new VercelBalancingStore();
  return production;
}
