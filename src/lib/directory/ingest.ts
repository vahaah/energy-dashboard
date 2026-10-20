import { ELEXON_ISD_API_URL } from "@/lib/attribution";
import {
  DIRECTORY_LATEST_PATH,
  DIRECTORY_PREVIOUS_PATH,
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
}): Promise<DirectoryIngestResult> {
  const empty = emptyResult();
  try {
    const extracts = await fetchExtracts(input.fetchText);
    const built = buildDirectory(extracts, input.now.toISOString());
    const snapshot = directorySnapshotSchema.parse(built.snapshot);
    return await publishSnapshot(snapshot, built.quarantined, input.store, input.now);
  } catch (error) {
    const message = error instanceof Error ? error.message : "directory ingest failed";
    if (message.includes("upstream")) {
      return { ...empty, error: message };
    }
    return { ...empty, error: "directory extract did not validate" };
  }
}

export async function runDirectoryIngest(now = new Date()): Promise<DirectoryIngestResult> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { ...emptyResult(), error: "blob store is not set" };
  }
  return ingestDirectory({
    now,
    store: directoryStore(),
    fetchText: async (url) => {
      const response = await fetch(url, {
        headers: { accept: "text/csv" },
        signal: AbortSignal.timeout(10_000),
      });
      return { status: response.status, body: response.ok ? await response.text() : "" };
    },
  });
}

async function fetchExtracts(fetchText: DirectoryFetch): Promise<DirectoryExtracts> {
  const extracts: Partial<DirectoryExtracts> = {};
  for (const filter of ISD_LOOKUP_FILTERS) {
    const url = isdEntityUrl(filter);
    if (url.includes("Filter=Full") || url.includes("Filter=LLF") || url.includes("Filter=ISDData")) {
      throw new Error("refusing a full ISD download");
    }
    const response = await fetchText(url);
    if (response.status === 429 || response.status >= 500) {
      throw new Error(`upstream ${response.status}`);
    }
    if (response.status !== 200 || response.body.length === 0) {
      throw new Error(`upstream ${response.status}`);
    }
    extracts[FILTER_FIELD[filter]] = response.body;
  }
  return extracts as DirectoryExtracts;
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
  const existing = await store.get(pathname);
  if (existing) {
    return;
  }
  try {
    await store.put(pathname, body, directoryImmutablePut());
  } catch (error) {
    const again = await store.get(pathname);
    if (!again) {
      throw error;
    }
  }
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
