import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadBundleReleases, loadGasRelease } from "@/lib/gas/query";
import { gasReleaseSchema, type GasRelease } from "@/lib/ingest/national-gas/release";

function fixtureReleasePath(cwd: string): string {
  return join(cwd, "tests/fixtures/gas/release.json");
}

/**
 * Latest National Gas NTS release and the recent gas days the page compares.
 * `readLatestGasRelease` is the Blob latest pointer. History is that release
 * plus the intraday and completed-day bundle releases, newest gas day first.
 */
export type GasReleaseReader = {
  readLatestGasRelease(): Promise<GasRelease | null>;
  readGasReleaseHistory(): Promise<readonly GasRelease[]>;
};

export function fixtureGasReleaseReader(cwd = process.cwd()): GasReleaseReader {
  let history: readonly GasRelease[] | undefined;
  const readHistory = (): readonly GasRelease[] => {
    if (!history) {
      const parsed = gasReleaseSchema.parse(JSON.parse(readFileSync(fixtureReleasePath(cwd), "utf8"))) as GasRelease;
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

export function blobGasReleaseReader(): GasReleaseReader {
  return {
    async readLatestGasRelease() {
      const loaded = await loadGasRelease(null);
      return loaded?.release ?? null;
    },
    async readGasReleaseHistory() {
      const [latest, bundles] = await Promise.all([loadGasRelease(null), loadBundleReleases()]);
      const releases = [...bundles];
      if (latest) {
        releases.push(latest.release);
      }
      const byDay = new Map<string, GasRelease>();
      for (const release of releases) {
        const existing = byDay.get(release.gas_day.label);
        if (!existing || newestPublishedAt(release) >= newestPublishedAt(existing)) {
          byDay.set(release.gas_day.label, release);
        }
      }
      return [...byDay.values()].sort((left, right) => right.gas_day.label.localeCompare(left.gas_day.label));
    },
  };
}

function newestPublishedAt(release: GasRelease): string {
  let stamp = "";
  for (const component of release.components) {
    if (component.published_at > stamp) {
      stamp = component.published_at;
    }
  }
  return stamp;
}

/**
 * Page data source. A deploy with `BLOB_READ_WRITE_TOKEN` reads Blob.
 * Tests, CI, and local e2e leave the token unset and keep the fixture.
 */
export function getGasReleaseReader(): GasReleaseReader {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return blobGasReleaseReader();
  }
  return fixtureGasReleaseReader();
}
