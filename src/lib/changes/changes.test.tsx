import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/v1/changes/route";
import { ChangesBoard } from "@/components/changes/changes-board";
import {
  API_ERROR_NO_RESULTS,
  API_ERROR_SCOPE,
  API_ERROR_SOURCE_UNAVAILABLE,
  API_ERROR_UNKNOWN_ID,
  API_ERROR_UNSUPPORTED_FILTER,
} from "@/lib/api/errors";
import { CHANGES_H1, CHANGES_STANDFIRST, CHANGES_SUPERSEDED, CHANGES_SUPERSEDES, CHANGES_TITLE } from "@/lib/changes/copy";
import { prepareChanges } from "@/lib/changes/prepare";
import {
  allChangeRows,
  changesQueryResponse,
  readCheckedInChanges,
  resetHeldChangesForTests,
  type ChangesBundle,
} from "@/lib/changes/query";
import { changeSentence } from "@/lib/changes/template";
import type { ChangeEvent, ChangeEventsFile } from "@/lib/projects/schema";

const RELEASE_A = "neso-open-data:tec-register:2026-10-13T13:58:33.755Z";
const RELEASE_B = "neso-open-data:tec-register:2026-10-14T00:00:00.000Z";

function event(overrides: Partial<ChangeEvent> & Pick<ChangeEvent, "entity" | "field" | "comparison">): ChangeEvent {
  return {
    observed_at: "2026-10-15T13:35:58.791Z",
    effective_at: null,
    old: "not_started",
    new: "built",
    old_release_id: RELEASE_A,
    new_release_id: RELEASE_B,
    ...overrides,
  };
}

function bundle(events: ChangeEvent[], options?: Partial<ChangesBundle>): ChangesBundle {
  const file: ChangeEventsFile = {
    catalogue_schema_version: 1,
    observed_at: "2026-10-15T13:35:58.791Z",
    events,
  };
  return {
    unavailable: false,
    events: file,
    held: file,
    projects: new Map([["epj_aaaaaaaaaaaaaaaa", { name: "Example station" }]]),
    sources: new Map([
      [
        "neso-open-data",
        {
          source_id: "neso-open-data",
          name: "NESO",
          licence: "NESO Open Data",
          licence_url: "https://www.neso.energy",
          attribution: "Supported by National Energy SO Open Data",
        },
      ],
    ]),
    ...options,
  };
}

describe("change events", () => {
  it("keeps old, new, and both release ids on every checked-in event", async () => {
    const checked = await readCheckedInChanges();
    expect(checked.unavailable).toBe(false);
    expect(checked.events?.events.length).toBeGreaterThan(0);
    for (const row of checked.events?.events ?? []) {
      expect(row).toHaveProperty("old");
      expect(row).toHaveProperty("new");
      expect(row.old_release_id.trim().length).toBeGreaterThan(0);
      expect(row.new_release_id.trim().length).toBeGreaterThan(0);
    }
    const listed = allChangeRows(checked);
    expect(listed?.changes).toHaveLength(checked.events?.events.length ?? 0);
    expect(listed?.next_cursor).toBe("");
    expect(listed?.sources.some((source) => source.source_id === "neso-open-data")).toBe(true);
    const first = listed?.changes[0];
    expect(first?.sentence).toBe(
      "Clashindarroch 2 construction status changed from Not started to Under construction.",
    );
    expect(first?.evidence).toBe(
      "Compared NESO (TEC register) of 13 Oct 2026. Both sides are that publication; there is no earlier snapshot in the catalogue.",
    );
    expect(changeSentence(checked.events!.events[0]!, "Clashindarroch 2")).toBe(first?.sentence);
  });

  it("uses a fixed sentence and lets a correction supersede the earlier comparison", () => {
    const events = [
      event({ entity: "epj_aaaaaaaaaaaaaaaa", field: "construction_status", comparison: "field" }),
      event({
        entity: "epj_aaaaaaaaaaaaaaaa",
        field: "construction_status",
        comparison: "correction",
        old: "built",
        new: "not_started",
      }),
      event({ entity: "epj_aaaaaaaaaaaaaaaa", field: "operational_status", comparison: "not_in_release", old: "proposed", new: null }),
    ];
    const prepared = prepareChanges(events);
    expect(prepared.map((row) => row.superseded)).toEqual([true, false, false]);
    expect(prepared.map((row) => row.supersedes)).toEqual([false, true, false]);
    const page = changesQueryResponse(new URLSearchParams(), bundle(events));
    expect(page.status).toBe(200);
    if (!("changes" in page.body)) {
      throw new Error("expected changes");
    }
    expect(page.body.changes.map((row) => row.sentence)).toEqual([
      "Example station construction status changed from Not started to Built.",
      "Example station construction status was corrected from Built to Not started.",
      "Example station is in the earlier release and is not in the later release.",
    ]);
    expect(page.body.changes.map((row) => row.status)).toEqual([CHANGES_SUPERSEDED, CHANGES_SUPERSEDES, null]);
    expect(page.body.changes.map((row) => row.evidence)).toEqual([
      "Compared NESO (TEC register) of 13 Oct 2026 with 14 Oct 2026.",
      "Compared NESO (TEC register) of 13 Oct 2026 with 14 Oct 2026.",
      "Compared NESO (TEC register) of 13 Oct 2026 with 14 Oct 2026.",
    ]);
    const again = changesQueryResponse(new URLSearchParams(), bundle(events));
    expect(again.body).toEqual(page.body);
  });

  it("pages with a cursor and returns the specified errors", () => {
    const events = Array.from({ length: 21 }, (_, index) =>
      event({
        entity: "epj_aaaaaaaaaaaaaaaa",
        field: `power_mw_${index}`,
        comparison: "field",
        old: index,
        new: index + 1,
      }),
    );
    const first = changesQueryResponse(new URLSearchParams(), bundle(events));
    expect(first.status).toBe(200);
    if (!("changes" in first.body)) {
      throw new Error("expected changes");
    }
    expect(first.body.changes).toHaveLength(20);
    expect(first.body.next_cursor).toBe("v1:20");
    const second = changesQueryResponse(new URLSearchParams("cursor=v1:20"), bundle(events));
    if (!("changes" in second.body)) {
      throw new Error("expected changes");
    }
    expect(second.body.changes).toHaveLength(1);
    expect(second.body.next_cursor).toBe("");

    expect(changesQueryResponse(new URLSearchParams("entity_id=missing"), bundle(events))).toEqual({
      status: 404,
      body: { error: API_ERROR_UNKNOWN_ID },
    });
    expect(changesQueryResponse(new URLSearchParams("entity_id="), bundle(events))).toEqual({
      status: 404,
      body: { error: API_ERROR_UNKNOWN_ID },
    });
    expect(
      changesQueryResponse(new URLSearchParams("entity_id=epj_bbbbbbbbbbbbbbbb"), bundle(events, {
        projects: new Map([["epj_bbbbbbbbbbbbbbbb", { name: "Quiet" }]]),
      })),
    ).toEqual({ status: 404, body: { error: API_ERROR_NO_RESULTS } });
    expect(changesQueryResponse(new URLSearchParams("cursor=v1:99"), bundle(events))).toEqual({
      status: 404,
      body: { error: API_ERROR_NO_RESULTS },
    });
    expect(changesQueryResponse(new URLSearchParams("scope=NI"), bundle(events))).toEqual({
      status: 400,
      body: { error: API_ERROR_SCOPE },
    });
    expect(changesQueryResponse(new URLSearchParams("geography=Northern Ireland"), bundle(events))).toEqual({
      status: 400,
      body: { error: API_ERROR_SCOPE },
    });
    expect(changesQueryResponse(new URLSearchParams("fuel=wind"), bundle(events))).toEqual({
      status: 400,
      body: { error: API_ERROR_UNSUPPORTED_FILTER },
    });
    expect(changesQueryResponse(new URLSearchParams("cursor=nope"), bundle(events))).toEqual({
      status: 400,
      body: { error: API_ERROR_UNSUPPORTED_FILTER },
    });
    expect(changesQueryResponse(new URLSearchParams("scope=GB"), bundle(events)).status).toBe(200);

    const down = bundle(events, { unavailable: true, events: null, held: null });
    expect(changesQueryResponse(new URLSearchParams(), down)).toEqual({
      status: 503,
      body: { error: API_ERROR_SOURCE_UNAVAILABLE },
    });
    const held = bundle(events, { unavailable: true, events: null });
    const heldPage = changesQueryResponse(new URLSearchParams("cursor=v1:20"), held);
    expect(heldPage.status).toBe(200);
    if (!("notice" in heldPage.body)) {
      throw new Error("expected held data");
    }
    expect(heldPage.body.notice).toBe(API_ERROR_SOURCE_UNAVAILABLE);
    expect(heldPage.body.changes).toHaveLength(1);
  });

  it("renders one row per comparison", () => {
    const html = renderToStaticMarkup(
      <ChangesBoard
        rows={[
          {
            key: "a",
            name: "Example station",
            href: "/projects/epj_aaaaaaaaaaaaaaaa/example-station",
            sentence: "Example station construction status changed from Not started to Built.",
            evidence: "Compared NESO (TEC register) of 13 Oct 2026 with 14 Oct 2026.",
            status: null,
            observedAt: "2026-10-15T13:35:58.791Z",
            effectiveAt: null,
          },
          {
            key: "b",
            name: "epj_cccccccccccccccc",
            href: null,
            sentence: "epj_cccccccccccccccc is in the earlier release and is not in the later release.",
            evidence: "Compared NESO (TEC register) of 13 Oct 2026 with 14 Oct 2026.",
            status: CHANGES_SUPERSEDED,
            observedAt: "2026-10-15T13:35:58.791Z",
            effectiveAt: "2026-10-14",
          },
        ]}
        attribution="Supported by National Energy SO Open Data"
      />,
    );
    expect(html).toContain("2 changes");
    expect(html.match(/<article/g)).toHaveLength(2);
    expect(html).toContain("Supported by National Energy SO Open Data");
    expect(CHANGES_TITLE).toBe("Changes in GB energy project registers | Grid");
    expect(CHANGES_H1).toBe("What has changed, and how do we know?");
    expect(CHANGES_STANDFIRST).toBe("Changes found in published data, each with its source and comparison.");
    const page = readFileSync(resolve(process.cwd(), "src/app/changes/page.tsx"), "utf8");
    expect(page).toContain('export const dynamic = "force-static"');
    expect(page).toContain("export const revalidate = 86400");
    expect(page).not.toContain("queryPipe");
  });

  it("serves the checked-in file from GET /api/v1/changes", async () => {
    const response = await GET(new Request("http://localhost/api/v1/changes"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { changes: Array<{ old_release_id: string; new_release_id: string }>; next_cursor: string; sources: unknown[] };
    expect(body.changes.length).toBeGreaterThan(0);
    expect(body.changes.every((row) => row.old_release_id.length > 0 && row.new_release_id.length > 0)).toBe(true);
    expect(body.next_cursor).toBe("");
    expect(body.sources.length).toBeGreaterThan(0);
    const scope = await GET(new Request("http://localhost/api/v1/changes?scope=NI"));
    expect(scope.status).toBe(400);
    expect(await scope.json()).toEqual({ error: API_ERROR_SCOPE });
    const unknown = await GET(new Request("http://localhost/api/v1/changes?entity_id=missing"));
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: API_ERROR_UNKNOWN_ID });
    const repeated = await GET(new Request("http://localhost/api/v1/changes?scope=GB&scope=NI"));
    expect(repeated.status).toBe(400);
    expect(await repeated.json()).toEqual({ error: API_ERROR_SCOPE });
  });

  it("returns the last held file when a later read times out", async () => {
    resetHeldChangesForTests();
    const cold = await readCheckedInChanges(AbortSignal.abort());
    expect(cold.unavailable).toBe(true);
    expect(cold.held).toBeNull();
    expect(changesQueryResponse(new URLSearchParams(), cold)).toEqual({
      status: 503,
      body: { error: API_ERROR_SOURCE_UNAVAILABLE },
    });

    const fresh = await readCheckedInChanges();
    expect(fresh.unavailable).toBe(false);
    const timedOut = await readCheckedInChanges(AbortSignal.abort());
    expect(timedOut.unavailable).toBe(true);
    expect(timedOut.events).toBeNull();
    expect(timedOut.held).toBe(fresh.events);
    const page = changesQueryResponse(new URLSearchParams(), timedOut);
    expect(page.status).toBe(200);
    if (!("notice" in page.body)) {
      throw new Error("expected held rows");
    }
    expect(page.body.notice).toBe(API_ERROR_SOURCE_UNAVAILABLE);
    expect(page.body.changes).toHaveLength(fresh.events?.events.length ?? 0);
    expect(page.body.changes[0]?.old_release_id).toBe(fresh.events?.events[0]?.old_release_id);
    const reader = readFileSync(resolve(process.cwd(), "src/lib/changes/query.ts"), "utf8");
    expect(reader).toContain("AbortSignal.timeout(CHANGES_READ_TIMEOUT_MS)");
    expect(reader).toContain("return heldAfterFailure(heldBundle)");
    expect(reader).toContain("signal");
  });
});
