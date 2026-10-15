import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { commitWholeEnergyEdition } from "@/lib/whole-energy/catalogue-write";
import { loadWholeEnergyEdition } from "@/lib/whole-energy/load";
import type { WholeEnergyEdition } from "@/lib/whole-energy/schema";

function lines(path: string): unknown[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as unknown);
}

function changed(edition: WholeEnergyEdition): WholeEnergyEdition {
  const next = structuredClone(edition);
  const row = next.rows[0];
  if (!row) {
    throw new Error("edition has no rows");
  }
  row.ktoe.total = row.ktoe.total === "1.00" ? "2.00" : "1.00";
  return next;
}

describe("whole energy catalogue write", () => {
  it("refuses a changed extract before it rewrites the checked-in edition", () => {
    const root = mkdtempSync(join(tmpdir(), "whole-energy-"));
    const edition = loadWholeEnergyEdition();
    commitWholeEnergyEdition(root, edition, new Date("2026-10-15T12:00:00.000Z"));
    const before = readFileSync(join(root, "data/catalogue/whole-energy.json"), "utf8");
    expect(() => commitWholeEnergyEdition(root, changed(edition), new Date("2026-10-15T12:00:01.000Z"))).toThrow(
      /different content/,
    );
    expect(readFileSync(join(root, "data/catalogue/whole-energy.json"), "utf8")).toBe(before);
    expect(lines(join(root, "data/catalogue/source_releases.ndjson"))).toHaveLength(1);
  });

  it("appends an ingestion run when the same release is imported again", () => {
    const root = mkdtempSync(join(tmpdir(), "whole-energy-"));
    const edition = loadWholeEnergyEdition();
    const clock = new Date("2026-10-15T12:00:00.000Z");
    const first = commitWholeEnergyEdition(root, edition, clock);
    const second = commitWholeEnergyEdition(root, edition, clock);
    expect(first.wroteRelease).toBe(true);
    expect(second.wroteRelease).toBe(false);
    expect(second.sourceReleaseId).toBe(first.sourceReleaseId);
    expect(second.ingestionRunId).not.toBe(first.ingestionRunId);
    expect(lines(join(root, "data/catalogue/source_releases.ndjson"))).toHaveLength(1);
    expect(lines(join(root, "data/catalogue/ingestion_runs.ndjson"))).toHaveLength(2);
  });
});
