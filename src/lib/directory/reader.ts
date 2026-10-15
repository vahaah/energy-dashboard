import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DIRECTORY_LATEST_PATH, directoryReleasePath, directoryStore } from "@/lib/directory/blob";
import { buildDirectory, type DirectoryExtracts } from "@/lib/directory/build";
import { directoryPointerSchema, directorySnapshotSchema, type DirectorySnapshot } from "@/lib/directory/schema";

const FIXTURE_RECORDED_AT = "2026-10-15T06:15:00.000Z";

export type DirectoryReader = {
  readDirectory(): Promise<DirectorySnapshot | null>;
};

export function fixtureDirectoryExtracts(cwd = process.cwd()): DirectoryExtracts {
  const dir = join(cwd, "tests/fixtures/directory");
  return {
    organisations: readFileSync(join(dir, "entity1.csv"), "utf8"),
    marketRoles: readFileSync(join(dir, "entity21.csv"), "utf8"),
    gspGroups: readFileSync(join(dir, "entity18.csv"), "utf8"),
    participantRoles: readFileSync(join(dir, "entity45.csv"), "utf8"),
    bmUnits: readFileSync(join(dir, "entity61.csv"), "utf8"),
  };
}

export function fixtureDirectorySnapshot(cwd = process.cwd()): DirectorySnapshot {
  return buildDirectory(fixtureDirectoryExtracts(cwd), FIXTURE_RECORDED_AT).snapshot;
}

export function fixtureDirectoryReader(cwd = process.cwd()): DirectoryReader {
  const snapshot = fixtureDirectorySnapshot(cwd);
  return {
    async readDirectory() {
      return snapshot;
    },
  };
}

export function blobDirectoryReader(): DirectoryReader {
  return {
    async readDirectory() {
      try {
        const pointerFile = await directoryStore().get(DIRECTORY_LATEST_PATH);
        if (!pointerFile) {
          return null;
        }
        const pointer = directoryPointerSchema.safeParse(JSON.parse(pointerFile.body));
        if (!pointer.success) {
          return null;
        }
        const hash = pointer.data.release_id.split(":").at(-1);
        if (!hash) {
          return null;
        }
        const release = await directoryStore().get(directoryReleasePath(hash));
        if (!release) {
          return null;
        }
        const parsed = directorySnapshotSchema.safeParse(JSON.parse(release.body));
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },
  };
}

/**
 * Lookup source. A deploy with `BLOB_READ_WRITE_TOKEN` reads Blob.
 * Tests, CI, and local e2e leave the token unset and keep the fixture.
 */
export function getDirectoryReader(): DirectoryReader {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return blobDirectoryReader();
  }
  return fixtureDirectoryReader();
}
