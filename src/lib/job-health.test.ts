import { afterEach, describe, expect, it } from "vitest";
import {
  CRON_JOB_IDS,
  loadJobHealth,
  publicJobError,
  recordJobFailure,
  recordJobSuccess,
  resetJobHealthForTests,
} from "@/lib/job-health";

afterEach(() => {
  resetJobHealthForTests();
  delete process.env.BLOB_READ_WRITE_TOKEN;
});

describe("job health", () => {
  it("counts a streak and clears it on the next success", async () => {
    expect(CRON_JOB_IDS).toContain("cron-northern-ireland");
    expect(CRON_JOB_IDS).toContain("cron-gas");

    await recordJobFailure("cron-northern-ireland", "EirGrid extract is missing", new Date("2026-10-21T04:15:00.000Z"));
    await recordJobFailure("cron-northern-ireland", "EirGrid extract is missing", new Date("2026-10-21T05:15:00.000Z"));
    await recordJobFailure("cron-gas", "National Gas raw body is missing", new Date("2026-10-21T04:05:00.000Z"));

    const failing = await loadJobHealth();
    expect(failing.find((job) => job.job === "cron-northern-ireland")).toMatchObject({
      last_error: "EirGrid extract is missing",
      consecutive_failures: 2,
      last_failure_at: "2026-10-21T05:15:00.000Z",
      last_success_at: null,
    });
    expect(failing.find((job) => job.job === "cron-gas")?.consecutive_failures).toBe(1);
    expect(failing.find((job) => job.job === "cron")?.consecutive_failures).toBe(0);

    await recordJobSuccess("cron-northern-ireland", new Date("2026-10-21T06:15:00.000Z"));
    const recovered = await loadJobHealth();
    expect(recovered.find((job) => job.job === "cron-northern-ireland")).toMatchObject({
      last_error: null,
      consecutive_failures: 0,
      last_success_at: "2026-10-21T06:15:00.000Z",
      last_failure_at: "2026-10-21T05:15:00.000Z",
    });
  });

  it("strips a live token out of the stored error", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "blob-token-sentinel-value";
    const stored = publicJobError("put failed blob-token-sentinel-value Bearer secret-token");
    expect(stored).not.toContain("blob-token-sentinel-value");
    expect(stored).not.toContain("secret-token");
    expect(stored).toContain("[redacted]");

    await recordJobFailure("cron-gas", "put failed blob-token-sentinel-value");
    const health = await loadJobHealth();
    expect(JSON.stringify(health)).not.toContain("blob-token-sentinel-value");
  });
});
