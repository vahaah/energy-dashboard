import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { blobReadOrNull } from "@/lib/blob-read";
import { NI_LATEST_PATH, niReleasePath, niStore, parseNiPointer } from "@/lib/eirgrid/blob";
import { niReleaseSchema, type NiRelease } from "@/lib/eirgrid/release";

let fixture: NiRelease | null = null;

function fixtureRelease(): NiRelease {
  fixture ??= niReleaseSchema.parse(
    JSON.parse(readFileSync(resolve(process.cwd(), "tests/fixtures/eirgrid/release.json"), "utf8")),
  );
  return fixture;
}

/** Blob when the token is set. Tests, CI, and local dev use the checked-in fixture. */
export async function readNiRelease(): Promise<NiRelease | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return fixtureRelease();
  }
  return readBlobRelease();
}

async function readBlobRelease(): Promise<NiRelease | null> {
  const pointerText = await blobReadOrNull(() => niStore().get(NI_LATEST_PATH, true));
  const pointer = pointerText ? parseNiPointer(pointerText.body) : null;
  if (!pointer) {
    return null;
  }
  const file = await blobReadOrNull(() => niStore().get(niReleasePath(pointer.release_id), true));
  if (!file) {
    return null;
  }
  return niReleaseSchema.parse(JSON.parse(file.body));
}
