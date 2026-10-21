import { afterEach, describe, expect, it } from "vitest";
import { FatalError, RetryableError } from "workflow";
import {
  BLOB_READBACK_ATTEMPTS,
  BLOB_READBACK_BACKOFF_MS,
  STEP_INLINE_MAX_BYTES,
  blobReadbackError,
  fitsInline,
  isBlobAlreadyExists,
  observeJobFailure,
  putImmutable,
  readUntilPresent,
  setBlobReadbackSleepForTests,
} from "@/lib/blob-readback";
import { resetJobHealthForTests, loadJobHealth } from "@/lib/job-health";

afterEach(() => {
  setBlobReadbackSleepForTests(null);
  resetJobHealthForTests();
});

describe("blob read-back", () => {
  it("puts with no preceding get and treats already exists as success", async () => {
    const files = new Map<string, string>();
    let gets = 0;
    const put = async () => {
      if (files.has("raw")) {
        throw new Error("The blob already exists");
      }
      files.set("raw", "body");
    };
    const confirm = async () => {
      gets += 1;
      return files.has("raw");
    };

    await putImmutable(put, confirm);
    await putImmutable(put, confirm);

    expect(gets).toBe(0);
    expect(files.get("raw")).toBe("body");
    expect(isBlobAlreadyExists(new Error("eirgrid blob exists: raw"))).toBe(true);
    expect(isBlobAlreadyExists({ code: "blob_already_exists" })).toBe(true);
  });

  it("confirms a swallowed already-exists error and rethrows anything else", async () => {
    let confirmed = false;
    await putImmutable(
      async () => {
        throw new Error("Unknown error, please visit https://vercel.com/help.");
      },
      async () => {
        confirmed = true;
        return true;
      },
    );
    expect(confirmed).toBe(true);

    await expect(
      putImmutable(
        async () => {
          throw new Error("network down");
        },
        async () => false,
      ),
    ).rejects.toThrow("network down");
  });

  it("returns the body after the first two reads are not-found", async () => {
    const waits: number[] = [];
    setBlobReadbackSleepForTests(async (ms) => {
      waits.push(ms);
    });
    let misses = 0;
    const body = await readUntilPresent(async () => {
      misses += 1;
      return misses <= 2 ? null : "csv";
    });

    expect(body).toBe("csv");
    expect(misses).toBe(3);
    expect(waits).toEqual([2_000, 3_000]);
    expect(BLOB_READBACK_ATTEMPTS).toBe(5);
    expect(BLOB_READBACK_BACKOFF_MS.reduce((sum, wait) => sum + wait, 0)).toBe(14_000);
    expect(fitsInline(STEP_INLINE_MAX_BYTES)).toBe(true);
    expect(fitsInline(STEP_INLINE_MAX_BYTES + 1)).toBe(false);
  });

  it("is retryable until the step's last attempt", async () => {
    expect(blobReadbackError("EirGrid extract is missing", 2, 1)).toBeInstanceOf(RetryableError);
    expect(blobReadbackError("National Gas raw body is missing", 2, 2)).toBeInstanceOf(RetryableError);
    const fatal = blobReadbackError("EirGrid extract is missing", 2, 3);
    expect(fatal).toBeInstanceOf(FatalError);
    expect((blobReadbackError("EirGrid extract is missing", 2, 1) as RetryableError).retryAfter.getTime()).toBeGreaterThan(
      Date.now(),
    );

    await observeJobFailure("cron-northern-ireland", new RetryableError("EirGrid extract is missing"), 2, 1);
    let health = await loadJobHealth();
    expect(health.find((job) => job.job === "cron-northern-ireland")?.consecutive_failures).toBe(0);

    await observeJobFailure("cron-northern-ireland", fatal, 2, 3);
    health = await loadJobHealth();
    expect(health.find((job) => job.job === "cron-northern-ireland")).toMatchObject({
      consecutive_failures: 1,
      last_error: "EirGrid extract is missing",
    });
  });
});
