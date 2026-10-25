import { ELEXON_ISD_API_URL } from "@/lib/attribution";
import { putImmutable } from "@/lib/blob-readback";
import {
  DIRECTORY_LATEST_PATH,
  DIRECTORY_PREVIOUS_PATH,
  directoryBlobCommand,
  directoryImmutablePut,
  directoryMutablePut,
  directoryReleasePath,
  directoryStore,
  type DirectoryObjectStore,
} from "@/lib/directory/blob";
import { buildDirectory, type DirectoryExtracts } from "@/lib/directory/build";
import { directoryPointerSchema, directorySnapshotSchema, type DirectorySnapshot } from "@/lib/directory/schema";

export const ISD_LOOKUP_FILTERS = [
  "ISDEntity1",
  "ISDEntity18",
  "ISDEntity21",
  "ISDEntity45",
  "ISDEntity61",
] as const;

export type IsdLookupFilter = (typeof ISD_LOOKUP_FILTERS)[number];

const FILTER_FIELD: Record<IsdLookupFilter, keyof DirectoryExtracts> = {
  ISDEntity1: "organisations",
  ISDEntity18: "gspGroups",
  ISDEntity21: "marketRoles",
  ISDEntity45: "participantRoles",
  ISDEntity61: "bmUnits",
};

export function isdEntityUrl(filter: IsdLookupFilter): string {
  const url = new URL(ELEXON_ISD_API_URL);
  url.searchParams.set("Filter", filter);
  return url.toString();
}

export type DirectoryFetch = (url: string) => Promise<{ status: number; body: string }>;

/** Five entity files, three attempts each, stay inside the 300s route. */
export const DIRECTORY_FETCH_TIMEOUT_MS = 15_000;
export const DIRECTORY_FETCH_RETRIES = 2;

export function directoryRequestBackoffMs(attempt: number): number {
  return attempt <= 1 ? 200 : 800;
}

export type DirectoryIngestResult = {
  ok: boolean;
  unchanged: boolean;
  organisations: number;
  identifiers: number;
  roles: number;
  quarantined: number;
  bytes: number;
  hash: string;
  releaseId: string;
  error?: string;
};

export async function ingestDirectory(input: {
  now: Date;
  fetchText: DirectoryFetch;
  store: DirectoryObjectStore;
  sleep?: (ms: number) => Promise<void>;
}): Promise<DirectoryIngestResult> {
  const empty = emptyResult();
  try {
    const extracts = await fetchExtracts(input.fetchText, input.sleep ?? defaultDirectorySleep);
    const built = buildDirectory(extracts, input.now.toISOString());
    const snapshot = directorySnapshotSchema.parse(built.snapshot);
    return await publishSnapshot(snapshot, built.quarantined, input.store, input.now);
  } catch (error) {
    return { ...empty, error: directoryErrorMessage(error) };
  }
}

export async function runDirectoryIngest(now = new Date()): Promise<DirectoryIngestResult> {
  if (!directoryBlobCommand()) {
    return { ...emptyResult(), error: "blob store is not set" };
  }
  return ingestDirectory({
    now,
    store: directoryStore(),
    fetchText: async (url) => {
      const response = await fetch(url, {
        headers: { accept: "text/csv" },
        signal: AbortSignal.timeout(DIRECTORY_FETCH_TIMEOUT_MS),
      });
      return { status: response.status, body: response.ok ? await response.text() : "" };
    },
  });
}

function defaultDirectorySleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function directoryErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "directory ingest failed";
  if (
    message.startsWith("upstream ") ||
    message.includes("columns changed") ||
    message.includes("timeout") ||
    message.includes("aborted") ||
    message === "fetch failed" ||
    message === "blob store is not set" ||
    message.startsWith("directory blob")
  ) {
    return message;
  }
  if (message.startsWith("Vercel Blob:")) {
    return message.replace(/vercel_blob_\S+/g, "[redacted]").slice(0, 300);
  }
  return "directory extract did not validate";
}

function isDirectoryRetryable(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const name = "name" in error ? String(error.name) : "";
  if (name === "TimeoutError" || name === "AbortError") {
    return true;
  }
  const message = "message" in error ? String(error.message) : "";
  return message.includes("timeout") || message.includes("aborted") || message.includes("fetch failed");
}

async function fetchExtracts(
  fetchText: DirectoryFetch,
  sleep: (ms: number) => Promise<void>,
): Promise<DirectoryExtracts> {
  const extracts: Partial<DirectoryExtracts> = {};
  for (const filter of ISD_LOOKUP_FILTERS) {
    const url = isdEntityUrl(filter);
    if (url.includes("Filter=Full") || url.includes("Filter=LLF") || url.includes("Filter=ISDData")) {
      throw new Error("refusing a full ISD download");
    }
    extracts[FILTER_FIELD[filter]] = await fetchLookup(fetchText, url, sleep);
  }
  return extracts as DirectoryExtracts;
}

async function fetchLookup(
  fetchText: DirectoryFetch,
  url: string,
  sleep: (ms: number) => Promise<void>,
): Promise<string> {
  for (let attempt = 1; attempt <= DIRECTORY_FETCH_RETRIES + 1; attempt += 1) {
    try {
      const response = await fetchText(url);
      if (response.status === 200 && response.body.length > 0) {
        return response.body;
      }
      const retryable =
        response.status === 429 || response.status >= 500 || (response.status === 200 && response.body.length === 0);
      if (!retryable || attempt > DIRECTORY_FETCH_RETRIES) {
        throw new Error(`upstream ${response.status}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("upstream ")) {
        throw error;
      }
      if (!isDirectoryRetryable(error) || attempt > DIRECTORY_FETCH_RETRIES) {
        throw error;
      }
    }
    await sleep(directoryRequestBackoffMs(attempt));
  }
  throw new Error("upstream 0");
}

async function publishSnapshot(
  snapshot: DirectorySnapshot,
  quarantined: number,
  store: DirectoryObjectStore,
  now: Date,
): Promise<DirectoryIngestResult> {
  const base = {
    ok: true,
    unchanged: false,
    organisations: snapshot.organisations.length,
    identifiers: snapshot.identifiers.length,
    roles: snapshot.role_assignments.length,
    quarantined,
    bytes: 0,
    hash: snapshot.content_hash,
    releaseId: snapshot.release_id,
  };
  const existing = await store.get(DIRECTORY_LATEST_PATH);
  if (existing) {
    const pointer = directoryPointerSchema.safeParse(JSON.parse(existing.body));
    if (pointer.success && pointer.data.release_id === snapshot.release_id) {
      return { ...base, unchanged: true };
    }
  }
  const body = `${JSON.stringify(snapshot)}\n`;
  await putReleaseIfAbsent(store, directoryReleasePath(snapshot.content_hash), body);
  const pointer = `${JSON.stringify({
    release_id: snapshot.release_id,
    generated_at: now.toISOString(),
  })}\n`;
  if (existing) {
    await store.put(DIRECTORY_PREVIOUS_PATH, existing.body, directoryMutablePut());
  }
  await store.put(DIRECTORY_LATEST_PATH, pointer, directoryMutablePut());
  return { ...base, bytes: Buffer.byteLength(body) };
}

async function putReleaseIfAbsent(store: DirectoryObjectStore, pathname: string, body: string): Promise<void> {
  await putImmutable(
    () => store.put(pathname, body, directoryImmutablePut()),
    async () => (await store.get(pathname)) != null,
  );
}

function emptyResult(): DirectoryIngestResult {
  return {
    ok: false,
    unchanged: false,
    organisations: 0,
    identifiers: 0,
    roles: 0,
    quarantined: 0,
    bytes: 0,
    hash: "",
    releaseId: "",
  };
}
