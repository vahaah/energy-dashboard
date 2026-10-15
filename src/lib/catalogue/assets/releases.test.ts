import { describe, expect, it } from "vitest";
import { newestExtractSha256 } from "@/lib/catalogue/assets/releases";

describe("newest source release hash", () => {
  it("uses the latest matching extract and ignores a later line with an older timestamp", () => {
    const datasetId = "desnz-repd:repd-quarterly";
    expect(
      newestExtractSha256(
        [
          {
            dataset_id: datasetId,
            published_at: "2026-01-01T00:00:00.000Z",
            content: { extract_sha256: "sha256:oldest" },
          },
          {
            dataset_id: datasetId,
            published_at: "2026-04-01T00:00:00.000Z",
            content: { extract_sha256: "sha256:newer" },
          },
          {
            dataset_id: "desnz-dukes:dukes-5.11",
            published_at: "2026-08-01T00:00:00.000Z",
            content: { extract_sha256: "sha256:other-dataset" },
          },
        ],
        datasetId,
      ),
    ).toBe("sha256:newer");

    expect(
      newestExtractSha256(
        [
          {
            dataset_id: datasetId,
            published_at: "2026-04-01T00:00:00.000Z",
            content: { extract_sha256: "sha256:newer-time" },
          },
          {
            dataset_id: datasetId,
            published_at: "2026-01-01T00:00:00.000Z",
            content: { extract_sha256: "sha256:older-time-later-line" },
          },
        ],
        datasetId,
      ),
    ).toBe("sha256:newer-time");

    expect(
      newestExtractSha256(
        [
          {
            dataset_id: datasetId,
            published_at: "2026-04-01T00:00:00.000Z",
            content: { extract_sha256: "sha256:first-equal" },
          },
          {
            dataset_id: datasetId,
            published_at: "2026-04-01T00:00:00.000Z",
            content: { extract_sha256: "sha256:second-equal" },
          },
        ],
        datasetId,
      ),
    ).toBe("sha256:second-equal");
  });
});
