import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FatalError } from "workflow";
import {
  CONSTRAINTS_LATEST_PATH,
  MemoryConstraintsStore,
  constraintsBundlePointerPath,
  constraintsBundlePreviousPath,
  constraintsImmutablePut,
  constraintsMetaPath,
  constraintsQuarantinePath,
  constraintsRawPath,
  constraintsReleasePath,
  setConstraintsStoreForTests,
} from "@/lib/constraints/blob";
import { sha256Text } from "@/lib/constraints/parse";
import { publishConstraintsBundle } from "@/lib/constraints/publish";
import { constraintReleaseId, type FetchMeta } from "@/lib/constraints/release";

const revalidated: string[] = [];

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => {
    revalidated.push(path);
  },
}));

const NOW = new Date("2026-10-15T04:40:00.000Z");

function meta(file: string): FetchMeta {
  return {
    bundle: "breakdown",
    source_url: `https://api.neso.energy/dataset/fixture/resource/fixture/download/${file}`,
    issued_at: "2026-10-09T12:32:21.000Z",
    financial_year: "2026-2027",
    resource_name: "Constraint Breakdown 2026-2027",
  };
}

async function stage(store: MemoryConstraintsStore, file: string, csv: string): Promise<string> {
  const hash = sha256Text(csv);
  const hex = hash.slice("sha256:".length);
  await store.put(constraintsRawPath(hex), csv, constraintsImmutablePut("text/csv"));
  await store.put(constraintsMetaPath(hex), `${JSON.stringify(meta(file))}\n`, constraintsImmutablePut("application/json"));
  return hash;
}

describe("constraint publish", () => {
  let store: MemoryConstraintsStore;

  beforeEach(() => {
    store = new MemoryConstraintsStore();
    setConstraintsStoreForTests(store);
    revalidated.length = 0;
  });

  afterEach(() => {
    setConstraintsStoreForTests(null);
  });

  it("keeps the previous release when a period is revised and when a file is quarantined", async () => {
    const current = readFileSync(join(process.cwd(), "tests/fixtures/constraints/breakdown.csv"), "utf8");
    const previous = readFileSync(join(process.cwd(), "tests/fixtures/constraints/breakdown-previous.csv"), "utf8");
    const firstHash = await stage(store, "breakdown-previous.csv", previous);
    const first = await publishConstraintsBundle(firstHash, "breakdown", NOW);
    const firstPath = constraintsReleasePath(first.releaseId);
    expect(store.files.has(firstPath)).toBe(true);

    const secondHash = await stage(store, "breakdown.csv", current);
    const second = await publishConstraintsBundle(secondHash, "breakdown", NOW);
    expect(second.releaseId).not.toBe(first.releaseId);
    expect(store.files.has(firstPath)).toBe(true);
    expect(store.files.has(constraintsReleasePath(second.releaseId))).toBe(true);
    const pointer = JSON.parse(store.files.get(constraintsBundlePointerPath("breakdown"))?.body ?? "{}") as {
      release_id: string;
    };
    const kept = JSON.parse(store.files.get(constraintsBundlePreviousPath("breakdown"))?.body ?? "{}") as {
      release_id: string;
    };
    expect(pointer.release_id).toBe(second.releaseId);
    expect(kept.release_id).toBe(first.releaseId);
    const again = await publishConstraintsBundle(secondHash, "breakdown", NOW);
    expect(again.releaseId).toBe(second.releaseId);
    expect(store.files.has(firstPath)).toBe(true);

    const bad = "Date,Surprise\n2026-10-08,1\n";
    const badHash = await stage(store, "bad.csv", bad);
    await expect(publishConstraintsBundle(badHash, "breakdown", NOW)).rejects.toBeInstanceOf(FatalError);
    const after = JSON.parse(store.files.get(constraintsBundlePointerPath("breakdown"))?.body ?? "{}") as {
      release_id: string;
    };
    expect(after.release_id).toBe(second.releaseId);
    const hex = badHash.slice("sha256:".length);
    expect(store.files.has(constraintsQuarantinePath("2026-10-15", hex))).toBe(true);
    expect(revalidated).toContain("/system/constraints");
    expect(revalidated).not.toContain("/");
    expect(store.files.has(CONSTRAINTS_LATEST_PATH)).toBe(true);
    const releaseBody = store.files.get(constraintsReleasePath(first.releaseId))?.body ?? "";
    expect(constraintReleaseId(JSON.parse(releaseBody))).toBe(first.releaseId);
  });
});
