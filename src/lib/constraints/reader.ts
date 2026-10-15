import { readFileSync } from "node:fs";
import { join } from "node:path";
import { constraintsBundlePointerPath, constraintsBundlePreviousPath } from "@/lib/constraints/blob";
import { buildRelease } from "@/lib/constraints/build";
import { readConstraintsPointer, readConstraintsRelease } from "@/lib/constraints/load";
import type { ConstraintRelease, ConstraintsBundle, FetchMeta } from "@/lib/constraints/release";

export type ConstraintsHistory = {
  latest: ConstraintRelease | null;
  previous: ConstraintRelease | null;
};

const FIXTURE_ISSUED = {
  breakdown: "2026-10-09T12:32:21.000Z",
  "day-ahead": "2026-10-14T16:11:39.000Z",
} as const;

const FIXTURE_RETRIEVED = "2026-10-15T04:40:00.000Z";

function readFixture(name: string): string {
  return readFileSync(join(process.cwd(), "tests/fixtures/constraints", name), "utf8");
}

function fixtureMeta(bundle: ConstraintsBundle, sourceName: string): FetchMeta {
  return {
    bundle,
    source_url: `https://api.neso.energy/dataset/fixture/resource/fixture/download/${sourceName}`,
    issued_at: FIXTURE_ISSUED[bundle],
    financial_year: bundle === "breakdown" ? "2026-2027" : null,
    resource_name: sourceName,
  };
}

function releaseFromFixture(bundle: ConstraintsBundle, file: string): ConstraintRelease {
  const csv = readFixture(file);
  const built = buildRelease(csv, fixtureMeta(bundle, file), new Date(FIXTURE_RETRIEVED), Buffer.byteLength(csv));
  if (!built.ok) {
    throw new Error(`constraint fixture ${file} did not parse`);
  }
  return built.release;
}

export function fixtureConstraintsHistory(bundle: ConstraintsBundle): ConstraintsHistory {
  switch (bundle) {
    case "breakdown":
      return {
        latest: releaseFromFixture("breakdown", "breakdown.csv"),
        previous: releaseFromFixture("breakdown", "breakdown-previous.csv"),
      };
    case "day-ahead":
      return {
        latest: releaseFromFixture("day-ahead", "day-ahead.csv"),
        previous: null,
      };
    default: {
      const exhaustive: never = bundle;
      return exhaustive;
    }
  }
}

function publishedFixture(): boolean {
  if (process.env.CONSTRAINTS_READ_BLOB === "1") {
    return false;
  }
  return !process.env.BLOB_READ_WRITE_TOKEN || process.env.VITEST === "true";
}

export async function readBundleHistory(bundle: ConstraintsBundle): Promise<ConstraintsHistory> {
  if (publishedFixture()) {
    return fixtureConstraintsHistory(bundle);
  }
  const latestPointer = await readConstraintsPointer(constraintsBundlePointerPath(bundle));
  const previousPointer = await readConstraintsPointer(constraintsBundlePreviousPath(bundle));
  const latest = latestPointer ? await readConstraintsRelease(latestPointer.release_id) : null;
  const previous = previousPointer ? await readConstraintsRelease(previousPointer.release_id) : null;
  return { latest, previous };
}

export async function readPublishedHistory(): Promise<{
  breakdown: ConstraintsHistory;
  dayAhead: ConstraintsHistory;
}> {
  if (publishedFixture()) {
    return {
      breakdown: fixtureConstraintsHistory("breakdown"),
      dayAhead: fixtureConstraintsHistory("day-ahead"),
    };
  }
  const [breakdown, dayAhead] = await Promise.all([readBundleHistory("breakdown"), readBundleHistory("day-ahead")]);
  return { breakdown, dayAhead };
}

/** Health reads Blob only. No token and no pointer are not yet available. */
export async function readBlobHistory(): Promise<{
  breakdown: ConstraintRelease | null;
  dayAhead: ConstraintRelease | null;
}> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { breakdown: null, dayAhead: null };
  }
  const [breakdown, dayAhead] = await Promise.all([
    readBundleHistory("breakdown"),
    readBundleHistory("day-ahead"),
  ]);
  return { breakdown: breakdown.latest, dayAhead: dayAhead.latest };
}
