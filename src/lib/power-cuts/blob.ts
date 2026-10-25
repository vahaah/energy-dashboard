import { readUntilPresent } from "@/lib/blob-readback";
import { del, get, list, put } from "@vercel/blob";
import { blobReadSignal, readBlobResponse, withBlobReadRetry } from "@/lib/blob-read";
import { ARCHIVE_KEEP_MS, powerCutsSnapshotSchema, type PowerCutsSnapshot } from "@/lib/power-cuts/schema";

export const POWER_CUTS_LATEST_PATH = "power-cuts/latest.json";

export function powerCutsArchivePath(now: Date): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hour = String(now.getUTCHours()).padStart(2, "0");
  return `power-cuts/${year}/${month}/${day}/${hour}.json`;
}

const ARCHIVE = /^power-cuts\/(\d{4})\/(\d{2})\/(\d{2})\/(\d{2})\.json$/;

export function archiveInstant(pathname: string): Date | null {
  const match = ARCHIVE.exec(pathname);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  return new Date(Date.UTC(year, month - 1, day, hour));
}

export type PowerCutsStore = {
  put(pathname: string, body: string, allowOverwrite: boolean): Promise<void>;
  get(pathname: string, cache: boolean): Promise<string | null>;
  list(prefix: string): Promise<Array<{ pathname: string; uploadedAt: Date }>>;
  del(pathnames: readonly string[]): Promise<void>;
};

export class MemoryPowerCutsStore implements PowerCutsStore {
  readonly files = new Map<string, { body: string; uploadedAt: Date }>();

  async put(pathname: string, body: string, allowOverwrite = true): Promise<void> {
    if (!allowOverwrite && this.files.has(pathname)) {
      return;
    }
    this.files.set(pathname, { body, uploadedAt: new Date() });
  }

  async get(pathname: string): Promise<string | null> {
    return this.files.get(pathname)?.body ?? null;
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

class VercelPowerCutsStore implements PowerCutsStore {
  async put(pathname: string, body: string, allowOverwrite: boolean): Promise<void> {
    await put(pathname, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
  }

  async get(pathname: string, cache: boolean): Promise<string | null> {
    const stored = await readBlobResponse(() =>
      get(pathname, { access: "public", useCache: cache, abortSignal: blobReadSignal() }),
    );
    if (!stored) {
      return null;
    }
    return stored.body;
  }

  async list(prefix: string): Promise<Array<{ pathname: string; uploadedAt: Date }>> {
    const found: Array<{ pathname: string; uploadedAt: Date }> = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await withBlobReadRetry(() => list({ prefix, cursor, limit: 1000, abortSignal: blobReadSignal() }));
      for (const blob of page.blobs) {
        found.push({ pathname: blob.pathname, uploadedAt: blob.uploadedAt });
      }
      cursor = page.hasMore ? page.cursor : undefined;
      pages += 1;
    } while (cursor && pages < 40);
    return found;
  }

  async del(pathnames: readonly string[]): Promise<void> {
    if (pathnames.length === 0) {
      return;
    }
    await del([...pathnames]);
  }
}

let storeOverride: PowerCutsStore | null = null;

export function setPowerCutsStoreForTests(store: PowerCutsStore | null): void {
  storeOverride = store;
}

export function powerCutsStore(): PowerCutsStore {
  return storeOverride ?? new VercelPowerCutsStore();
}

export function parseSnapshot(body: string): PowerCutsSnapshot | null {
  try {
    const parsed = powerCutsSnapshotSchema.safeParse(JSON.parse(body));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function readLatestSnapshot(store: PowerCutsStore = powerCutsStore()): Promise<PowerCutsSnapshot | null> {
  const body = await store.get(POWER_CUTS_LATEST_PATH, false);
  if (!body) {
    return null;
  }
  return parseSnapshot(body);
}

/** Put latest, read it back, then write the hourly archive and drop archives older than 30 days. */
export async function publishSnapshot(
  snapshot: PowerCutsSnapshot,
  now: Date,
  store: PowerCutsStore = powerCutsStore(),
): Promise<void> {
  const body = JSON.stringify(snapshot);
  await store.put(POWER_CUTS_LATEST_PATH, body, true);
  const read = await readUntilPresent(async () => {
    const got = await store.get(POWER_CUTS_LATEST_PATH, false);
    return got === body ? got : null;
  });
  if (read !== body) {
    throw new Error("power-cuts latest.json was not readable after publish");
  }
  await store.put(powerCutsArchivePath(now), body, true);
  const listed = await store.list("power-cuts/");
  const stale = listed
    .map((file) => file.pathname)
    .filter((pathname) => {
      const instant = archiveInstant(pathname);
      return instant != null && now.getTime() - instant.getTime() > ARCHIVE_KEEP_MS;
    });
  await store.del(stale);
}
