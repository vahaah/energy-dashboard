import { BlobNotFoundError, type GetBlobResult } from "@vercel/blob";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BLOB_READ_ATTEMPTS, BLOB_READ_BACKOFF_MS, readBlobResponse } from "@/lib/blob-read";
import { buildConstraintsPage } from "@/lib/constraints/page-model";
import { readPublishedHistory } from "@/lib/constraints/reader";
import { setConstraintsStoreForTests, type ConstraintsObjectStore } from "@/lib/constraints/blob";
import { blobDirectoryReader } from "@/lib/directory/reader";
import { setDirectoryStoreForTests, type DirectoryObjectStore } from "@/lib/directory/blob";
import { NI_EMPTY } from "@/lib/eirgrid/copy";
import { buildNiPage, pageStatus } from "@/lib/eirgrid/page-model";
import { readNiRelease } from "@/lib/eirgrid/reader";
import { setNiStoreForTests, type NiObjectStore } from "@/lib/eirgrid/blob";
import { setGasStoreForTests, type GasObjectStore } from "@/lib/gas/blob";
import { buildGasDocument } from "@/lib/gas/page-model";
import { getGasReleaseReader } from "@/lib/gas/release-reader";

const BLOB_500 = new Error("Vercel Blob: Failed to fetch blob: 500 Internal Server Error");

function okBlob(body: string): GetBlobResult {
  const stream = new Response(body).body;
  if (!stream) {
    throw new Error("missing blob stream");
  }
  return {
    statusCode: 200,
    stream,
    headers: new Headers(),
    blob: {
      url: "https://example.public.blob.vercel-storage.com/releases/a.json",
      downloadUrl: "https://example.public.blob.vercel-storage.com/releases/a.json?download=1",
      pathname: "releases/a.json",
      contentType: "application/json",
      contentDisposition: "",
      cacheControl: "public, max-age=60",
      size: Buffer.byteLength(body),
      uploadedAt: new Date("2026-10-15T09:05:00.000Z"),
      etag: "etag",
    },
  };
}

afterEach(() => {
  setConstraintsStoreForTests(null);
  setGasStoreForTests(null);
  setDirectoryStoreForTests(null);
  setNiStoreForTests(null);
  vi.unstubAllEnvs();
});

describe("blob read retry", () => {
  it("retries a 500 with backoff and then returns the body", async () => {
    const waits: number[] = [];
    let calls = 0;
    const stored = await readBlobResponse(
      async () => {
        calls += 1;
        if (calls < BLOB_READ_ATTEMPTS) {
          throw BLOB_500;
        }
        return okBlob('{"ok":true}');
      },
      async (ms) => {
        waits.push(ms);
      },
    );
    expect(stored?.body).toBe('{"ok":true}');
    expect(calls).toBe(BLOB_READ_ATTEMPTS);
    expect(waits).toEqual([...BLOB_READ_BACKOFF_MS]);
  });

  it("throws after the bounded retries when Blob keeps returning 500", async () => {
    let calls = 0;
    await expect(
      readBlobResponse(async () => {
        calls += 1;
        throw BLOB_500;
      }, async () => undefined),
    ).rejects.toThrow(BLOB_500.message);
    expect(calls).toBe(BLOB_READ_ATTEMPTS);
  });

  it("does not retry a missing blob or a 400", async () => {
    let missing = 0;
    const absent = await readBlobResponse(async () => {
      missing += 1;
      throw new BlobNotFoundError();
    }, async () => undefined);
    expect(absent).toBeNull();
    expect(missing).toBe(1);

    let rejected = 0;
    await expect(
      readBlobResponse(async () => {
        rejected += 1;
        throw new Error("Vercel Blob: Failed to fetch blob: 400 Bad Request");
      }, async () => undefined),
    ).rejects.toThrow(/400/);
    expect(rejected).toBe(1);
  });
});

describe("page fallback when Blob returns 500", () => {
  it("renders the constraints not-yet-available model", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
    vi.stubEnv("CONSTRAINTS_READ_BLOB", "1");
    const store: ConstraintsObjectStore = {
      async put() {
        throw new Error("put is fail-closed");
      },
      async get() {
        throw BLOB_500;
      },
      async list() {
        return [];
      },
      async del() {
        return undefined;
      },
    };
    setConstraintsStoreForTests(store);
    const history = await readPublishedHistory();
    expect(history.breakdown).toEqual({ latest: null, previous: null });
    expect(history.dayAhead).toEqual({ latest: null, previous: null });
    const model = buildConstraintsPage({
      breakdown: history.breakdown.latest,
      breakdownPrevious: history.breakdown.previous,
      dayAhead: history.dayAhead.latest,
    });
    expect(model.available).toBe(false);
  });

  it("still throws a non-transient Blob error from the constraints page read", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
    vi.stubEnv("CONSTRAINTS_READ_BLOB", "1");
    setConstraintsStoreForTests({
      async put() {
        return undefined;
      },
      async get() {
        throw new Error("Vercel Blob: Failed to fetch blob: 400 Bad Request");
      },
      async list() {
        return [];
      },
      async del() {
        return undefined;
      },
    });
    await expect(readPublishedHistory()).rejects.toThrow(/400/);
  });

  it("renders the gas not-yet-available document", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
    const store: GasObjectStore = {
      async put() {
        throw new Error("put is fail-closed");
      },
      async get() {
        throw BLOB_500;
      },
      async list() {
        return [];
      },
      async del() {
        return undefined;
      },
    };
    setGasStoreForTests(store);
    const history = await getGasReleaseReader().readGasReleaseHistory();
    expect(history).toEqual([]);
    expect(buildGasDocument(history, new Date("2026-10-15T12:00:00.000Z"), null).available).toBe(false);
  });

  it("renders the Northern Ireland empty sentence", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
    const store: NiObjectStore = {
      async put() {
        throw new Error("put is fail-closed");
      },
      async get() {
        throw BLOB_500;
      },
      async del() {
        return undefined;
      },
    };
    setNiStoreForTests(store);
    const release = await readNiRelease();
    expect(release).toBeNull();
    const model = buildNiPage(release, "Supported by EirGrid Group Data");
    expect(model.available).toBe(false);
    expect(pageStatus(model)).toBe(NI_EMPTY);
  });

  it("returns a missing directory snapshot", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
    const store: DirectoryObjectStore = {
      async put() {
        throw new Error("put is fail-closed");
      },
      async get() {
        throw BLOB_500;
      },
    };
    setDirectoryStoreForTests(store);
    await expect(blobDirectoryReader().readDirectory()).resolves.toBeNull();
  });
});
