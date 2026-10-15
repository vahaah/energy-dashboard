import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ingestionRunLine } from "@/lib/catalogue/assets/runs";
import { loadDukes } from "../../../../scripts/catalogue/dukes";
import { loadRepd } from "../../../../scripts/catalogue/repd";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function blockFetch(): string[] {
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    throw new Error("offline import fetched");
  }) as typeof fetch;
  return calls;
}

describe("ingestion runs", () => {
  it("uses the invocation clock and a distinct id", () => {
    const startedAt = "2026-10-14T23:00:00.000Z";
    const finishedAt = "2026-10-14T23:00:04.000Z";
    const releaseId = "desnz-repd:repd-quarterly:2026-08-03T09:00:03.000Z";
    const first = ingestionRunLine("desnz-repd:repd-quarterly", releaseId, startedAt, finishedAt);
    const second = ingestionRunLine("desnz-repd:repd-quarterly", releaseId, startedAt, finishedAt);
    expect(first.id).not.toBe(second.id);
    expect(first.id).not.toBe(`run:desnz-repd:repd-quarterly:${releaseId.split(":").slice(2).join(":")}`);
    const record = JSON.parse(first.line) as {
      started_at: string;
      finished_at: string;
      source_release_id: string;
      ingestion_run_id: string;
    };
    expect(record.started_at).toBe(startedAt);
    expect(record.finished_at).toBe(finishedAt);
    expect(record.source_release_id).toBe(releaseId);
    expect(record.ingestion_run_id).toBe(first.id);
  });
});

describe("offline extracts", () => {
  it("does not fetch when the REPD cache is missing", async () => {
    const calls = blockFetch();
    const root = mkdtempSync(join(tmpdir(), "repd-offline-"));
    await expect(loadRepd(true, root)).rejects.toThrow(/data\/catalogue\/raw\/repd\.csv/);
    expect(calls).toEqual([]);
  });

  it("does not fetch when the DUKES cache is missing", async () => {
    const calls = blockFetch();
    const root = mkdtempSync(join(tmpdir(), "dukes-offline-"));
    await expect(loadDukes(true, root)).rejects.toThrow(/data\/catalogue\/raw\/dukes-5\.11\.xlsx/);
    expect(calls).toEqual([]);
  });
});
