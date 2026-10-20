import { join } from "node:path";
import {
  API_ERROR_NO_RESULTS,
  API_ERROR_SOURCE_UNAVAILABLE,
  API_ERROR_UNKNOWN_ID,
  scopeRejection,
  unsupportedFilter,
  type ApiErrorBody,
} from "@/lib/api/errors";
import { changeEvidence, changeSentence, changeStatusLine } from "@/lib/changes/template";
import { prepareChanges } from "@/lib/changes/prepare";
import { loadCatalogue } from "@/lib/catalogue/load";
import type { CatalogueSource } from "@/lib/catalogue/schema";
import { loadProjectCatalogue } from "@/lib/projects/load";
import type { ChangeEvent, ChangeEventsFile } from "@/lib/projects/schema";

export const CHANGES_PAGE_SIZE = 20;

const ALLOWED = new Set(["entity_id", "cursor", "scope", "geography"]);
const CURSOR = /^v1:(\d+)$/;

export type ChangeSource = {
  source_id: string;
  name: string;
  licence: string;
  licence_url: string;
  attribution: string;
};

export type ChangeRow = {
  entity_id: string;
  name: string;
  field: string;
  comparison: ChangeEvent["comparison"];
  old: ChangeEvent["old"];
  new: ChangeEvent["new"];
  old_release_id: string;
  new_release_id: string;
  observed_at: string;
  effective_at: string | null;
  sentence: string;
  evidence: string;
  status: string | null;
  superseded: boolean;
};

export type ChangesResponse = {
  changes: ChangeRow[];
  next_cursor: string;
  sources: ChangeSource[];
  notice?: string;
};

export type NamedEntity = { name: string };

export type ChangesBundle = {
  unavailable: boolean;
  events: ChangeEventsFile | null;
  held: ChangeEventsFile | null;
  projects: ReadonlyMap<string, NamedEntity>;
  sources: ReadonlyMap<string, ChangeSource>;
};

export function allChangeRows(bundle: ChangesBundle): ChangesResponse | null {
  const file = bundle.unavailable ? bundle.held : bundle.events;
  if (!file) {
    return null;
  }
  const prepared = prepareChanges(file.events);
  const body: ChangesResponse = {
    changes: prepared.map((row) => toRow(row.event, bundle.projects, row.superseded, row.supersedes)),
    next_cursor: "",
    sources: sourcesFor(file.events, bundle.sources),
  };
  if (bundle.unavailable) {
    body.notice = API_ERROR_SOURCE_UNAVAILABLE;
  }
  return body;
}

let heldBundle: ChangesBundle | null = null;

export function readCheckedInChanges(): ChangesBundle {
  try {
    const bundle = loadCheckedInBundle();
    heldBundle = bundle;
    return bundle;
  } catch {
    return heldAfterFailure(heldBundle);
  }
}

/** Last successful read, marked unavailable. A process with nothing held returns no rows. */
export function heldAfterFailure(previous: ChangesBundle | null): ChangesBundle {
  if (previous?.events) {
    return {
      unavailable: true,
      events: null,
      held: previous.events,
      projects: previous.projects,
      sources: previous.sources,
    };
  }
  return {
    unavailable: true,
    events: null,
    held: null,
    projects: new Map(),
    sources: new Map(),
  };
}

function loadCheckedInBundle(): ChangesBundle {
  const catalogue = loadProjectCatalogue();
  const loaded = loadCatalogue(join(process.cwd(), "data", "catalogue"));
  const sources = new Map<string, ChangeSource>();
  if (loaded.sources.ok) {
    for (const source of loaded.sources.data) {
      sources.set(source.source_id, sourceRecord(source));
    }
  }
  return {
    unavailable: false,
    events: catalogue.changes,
    held: catalogue.changes,
    projects: catalogue.byId,
    sources,
  };
}

export function changesQueryResponse(
  params: URLSearchParams,
  bundle: ChangesBundle,
): { status: number; body: ChangesResponse | ApiErrorBody } {
  const scope = scopeRejection(params);
  if (scope) {
    return scope;
  }
  const extra = unsupportedFilter(params, ALLOWED);
  if (extra) {
    return extra;
  }
  const cursor = parseCursor(params.get("cursor"));
  if (cursor === "invalid") {
    return { status: 400, body: { error: "unsupported filter" } };
  }
  const file = bundle.unavailable ? bundle.held : bundle.events;
  if (!file) {
    return { status: 503, body: { error: API_ERROR_SOURCE_UNAVAILABLE } };
  }
  const entityId = params.get("entity_id");
  if (entityId != null && !knownEntity(entityId, file.events, bundle.projects)) {
    return { status: 404, body: { error: API_ERROR_UNKNOWN_ID } };
  }
  const prepared = prepareChanges(file.events).filter((row) => entityId == null || row.event.entity === entityId);
  if (cursor >= prepared.length || prepared.length === 0) {
    return { status: 404, body: { error: API_ERROR_NO_RESULTS } };
  }
  const page = prepared.slice(cursor, cursor + CHANGES_PAGE_SIZE);
  const next = cursor + page.length;
  const body: ChangesResponse = {
    changes: page.map((row) => toRow(row.event, bundle.projects, row.superseded, row.supersedes)),
    next_cursor: next < prepared.length ? `v1:${next}` : "",
    sources: sourcesFor(page.map((row) => row.event), bundle.sources),
  };
  if (bundle.unavailable) {
    body.notice = API_ERROR_SOURCE_UNAVAILABLE;
  }
  return { status: 200, body };
}

function toRow(
  event: ChangeEvent,
  projects: ReadonlyMap<string, NamedEntity>,
  superseded: boolean,
  supersedes: boolean,
): ChangeRow {
  const name = projects.get(event.entity)?.name ?? event.entity;
  return {
    entity_id: event.entity,
    name,
    field: event.field,
    comparison: event.comparison,
    old: event.old,
    new: event.new,
    old_release_id: event.old_release_id,
    new_release_id: event.new_release_id,
    observed_at: event.observed_at,
    effective_at: event.effective_at,
    sentence: changeSentence(event, name),
    evidence: changeEvidence(event),
    status: changeStatusLine(superseded, supersedes),
    superseded,
  };
}

function knownEntity(entityId: string, events: readonly ChangeEvent[], projects: ReadonlyMap<string, NamedEntity>): boolean {
  if (entityId.length === 0) {
    return false;
  }
  return projects.has(entityId) || events.some((event) => event.entity === entityId);
}

function parseCursor(value: string | null): number | "invalid" {
  if (value == null || value === "") {
    return 0;
  }
  const match = CURSOR.exec(value);
  if (!match?.[1]) {
    return "invalid";
  }
  const index = Number(match[1]);
  if (!Number.isSafeInteger(index) || index < 0) {
    return "invalid";
  }
  return index;
}

function sourcesFor(events: readonly ChangeEvent[], sources: ReadonlyMap<string, ChangeSource>): ChangeSource[] {
  const ids = new Set<string>();
  for (const event of events) {
    ids.add(sourceIdFromRelease(event.old_release_id));
    ids.add(sourceIdFromRelease(event.new_release_id));
  }
  return [...ids].sort().map((id) => sources.get(id) ?? fallbackSource(id));
}

export function sourceIdFromRelease(releaseId: string): string {
  const index = releaseId.indexOf(":");
  return index === -1 ? releaseId : releaseId.slice(0, index);
}

function sourceRecord(source: CatalogueSource): ChangeSource {
  return {
    source_id: source.source_id,
    name: source.name,
    licence: source.licence,
    licence_url: source.licence_url,
    attribution: source.attribution,
  };
}

function fallbackSource(sourceId: string): ChangeSource {
  return {
    source_id: sourceId,
    name: sourceId,
    licence: "",
    licence_url: "",
    attribution: "",
  };
}
