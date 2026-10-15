/**
 * Deterministic snapshot diff.
 *
 *   npx tsx scripts/catalogue/project-diff.ts --old old.json --new new.json --observed-at 2026-10-15T12:00:00.000Z --out data/catalogue/change_events.json
 *
 * A row missing from the newer snapshot is comparison `not_in_release`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { diffProjectSnapshots, type ProjectSnapshotRow } from "../../src/lib/projects/diff";

function flag(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} needs a value`);
  }
  return value;
}

const observedAt = flag("--observed-at");
const older = JSON.parse(readFileSync(resolve(flag("--old")), "utf8")) as ProjectSnapshotRow[];
const newer = JSON.parse(readFileSync(resolve(flag("--new")), "utf8")) as ProjectSnapshotRow[];
const events = diffProjectSnapshots(older, newer, observedAt);
writeFileSync(
  resolve(flag("--out")),
  `${JSON.stringify({ catalogue_schema_version: 1, observed_at: observedAt, events }, null, 2)}\n`,
);
console.log(`events ${events.length}`);
