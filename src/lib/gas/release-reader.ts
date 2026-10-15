import { readFileSync } from "node:fs";
import { gasReleasePath } from "@/lib/ingest/national-gas/check";
import { gasReleaseSchema, type GasRelease } from "@/lib/ingest/national-gas/release";

/**
 * Latest National Gas NTS release and the recent gas days the page compares.
 * P1A.7's Blob reader replaces the fixture implementation of this type.
 * `readLatestGasRelease` stays the method that reader owns.
 */
export type GasReleaseReader = {
  readLatestGasRelease(): Promise<GasRelease | null>;
  readGasReleaseHistory(): Promise<readonly GasRelease[]>;
};

export function fixtureGasReleaseReader(cwd = process.cwd()): GasReleaseReader {
  let history: readonly GasRelease[] | undefined;
  const readHistory = (): readonly GasRelease[] => {
    if (!history) {
      const parsed = gasReleaseSchema.parse(JSON.parse(readFileSync(gasReleasePath(cwd), "utf8"))) as GasRelease;
      history = [parsed];
    }
    return history;
  };
  return {
    async readLatestGasRelease() {
      const releases = await this.readGasReleaseHistory();
      return releases[0] ?? null;
    },
    async readGasReleaseHistory() {
      return readHistory();
    },
  };
}

/** Page data source. Swap the body for the P1A.7 reader after it merges. */
export function getGasReleaseReader(): GasReleaseReader {
  return fixtureGasReleaseReader();
}
