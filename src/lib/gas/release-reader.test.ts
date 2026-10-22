import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  GAS_LATEST_PATH,
  MemoryGasStore,
  gasBundlePointerPath,
  gasDayPointerPath,
  gasReleasePath,
  setGasStoreForTests,
} from "@/lib/gas/blob";
import { preferGasRelease } from "@/lib/gas/rank";
import { blobGasReleaseReader, fixtureGasReleaseReader, getGasReleaseReader } from "@/lib/gas/release-reader";
import { gasDayFromLabel } from "@/lib/ingest/national-gas/gas-day";
import { gasReleaseSchema, type GasRelease } from "@/lib/ingest/national-gas/release";

const TOKEN = "BLOB_READ_WRITE_TOKEN";

function fixtureRelease(): GasRelease {
  return gasReleaseSchema.parse(JSON.parse(readFileSync("tests/fixtures/gas/release.json", "utf8")));
}

afterEach(() => {
  setGasStoreForTests(null);
  delete process.env[TOKEN];
});

describe("gas release reader", () => {
  it("keeps the fixture when Blob is not configured", async () => {
    delete process.env[TOKEN];
    const release = await getGasReleaseReader().readLatestGasRelease();
    expect(release?.gas_day.label).toBe("2026-10-13");
    const direct = await fixtureGasReleaseReader().readGasReleaseHistory();
    expect(direct).toHaveLength(1);
  });

  it("reads the latest Blob release and both bundle days", async () => {
    process.env[TOKEN] = "configured";
    const store = new MemoryGasStore();
    const current = fixtureRelease();
    const previous: GasRelease = { ...current, gas_day: gasDayFromLabel("2026-10-12") };
    const latestPointer = JSON.stringify({ release_id: "current", generated_at: "2026-10-14T03:05:00.000Z" });
    const completedPointer = JSON.stringify({ release_id: "previous", generated_at: "2026-10-13T14:20:00.000Z" });
    await store.put(gasReleasePath("current"), JSON.stringify(current), {
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    await store.put(gasReleasePath("previous"), JSON.stringify(previous), {
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    await store.put(GAS_LATEST_PATH, latestPointer, {
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    await store.put(gasBundlePointerPath("intraday"), latestPointer, {
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    await store.put(gasBundlePointerPath("completed-day"), completedPointer, {
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    setGasStoreForTests(store);

    const latest = await getGasReleaseReader().readLatestGasRelease();
    expect(latest?.gas_day.label).toBe("2026-10-13");
    const history = await blobGasReleaseReader().readGasReleaseHistory();
    expect(history.map((release) => release.gas_day.label)).toEqual(["2026-10-13", "2026-10-12"]);
  });

  it("reads a day pointer that is not a bundle pointer and keeps the richer release", async () => {
    process.env[TOKEN] = "configured";
    const store = new MemoryGasStore();
    const current = fixtureRelease();
    const thin: GasRelease = {
      ...current,
      components: current.components.filter((row) => row.publication_id === "PUBOB693"),
    };
    const older: GasRelease = { ...current, gas_day: gasDayFromLabel("2026-10-11") };
    const put = async (pathname: string, body: string) => {
      await store.put(pathname, body, { allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60 });
    };
    await put(gasReleasePath("full"), JSON.stringify(current));
    await put(gasReleasePath("thin"), JSON.stringify(thin));
    await put(gasReleasePath("older"), JSON.stringify(older));
    await put(GAS_LATEST_PATH, JSON.stringify({ release_id: "thin", generated_at: "2026-10-14T11:40:00.000Z" }));
    await put(gasBundlePointerPath("intraday"), JSON.stringify({ release_id: "full", generated_at: "2026-10-14T03:05:00.000Z" }));
    await put(gasDayPointerPath("2026-10-13"), JSON.stringify({ release_id: "full", generated_at: "2026-10-14T03:05:00.000Z" }));
    await put(gasDayPointerPath("2026-10-11"), JSON.stringify({ release_id: "older", generated_at: "2026-10-12T12:00:00.000Z" }));
    setGasStoreForTests(store);

    expect(preferGasRelease(thin, current)).toBe(current);
    expect(preferGasRelease(current, thin)).toBe(current);
    const history = await blobGasReleaseReader().readGasReleaseHistory();
    expect(history.map((release) => release.gas_day.label)).toEqual(["2026-10-13", "2026-10-11"]);
    expect(history[0]?.components.some((row) => row.publication_id === "PUBOB2042")).toBe(true);
  });
});
