import { afterEach, describe, expect, it } from "vitest";
import { RetryableError } from "workflow";
import { setBlobReadbackSleepForTests } from "@/lib/blob-readback";
import { MemoryTecStore, setTecStoreForTests } from "@/lib/projects/blob";
import { validateTecRegister } from "@/lib/projects/publish";

describe("TEC raw read-back", () => {
  afterEach(() => {
    setTecStoreForTests(null);
    setBlobReadbackSleepForTests(null);
  });

  it("retries a missing extract instead of failing the step on the first miss", async () => {
    setBlobReadbackSleepForTests(async () => undefined);
    let reads = 0;
    const inner = new MemoryTecStore();
    setTecStoreForTests({
      put: (pathname, body, options) => inner.put(pathname, body, options),
      get: async () => {
        reads += 1;
        return null;
      },
      list: (prefix) => inner.list(prefix),
      del: (pathnames) => inner.del(pathnames),
    });

    const error = await validateTecRegister(`sha256:${"ab".repeat(32)}`, new Date("2026-10-21T06:15:00.000Z")).then(
      () => null,
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(RetryableError);
    expect((error as Error).message).toBe("NESO TEC raw body is missing");
    expect(reads).toBe(10);
  });
});
