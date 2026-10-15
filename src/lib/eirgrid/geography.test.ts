import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EIRGRID_GROUP_LICENCE_URL, NI_FLOW_NOTE } from "@/lib/attribution";
import { cataloguePageSources } from "@/lib/catalogue/page-sources";
import {
  combineOperationalGeographies,
  readOperationalMetric,
  resolveOperationalGeography,
} from "@/lib/eirgrid/geography";
import { buildNiPage, pageStatus, releaseContainsSterling, releaseGeographies } from "@/lib/eirgrid/page-model";
import { queryNorthernIreland } from "@/lib/eirgrid/query";
import { niReleaseSchema } from "@/lib/eirgrid/release";
import { EIRGRID_TINYBIRD_OPS } from "@/lib/eirgrid/budget";

const release = niReleaseSchema.parse(
  JSON.parse(readFileSync(resolve(process.cwd(), "tests/fixtures/eirgrid/release.json"), "utf8")),
);

describe("operational geography", () => {
  it("rejects UK on an operational metric", () => {
    expect(resolveOperationalGeography("UK")).toEqual({ ok: false, error: "unsupported_dimension" });
    expect(
      readOperationalMetric({ geography_id: "NI", expected_cadence: "PT15M" }, "UK"),
    ).toEqual({ ok: false, error: "unsupported_dimension" });
    expect(readOperationalMetric({ geography_id: "UK", expected_cadence: "P1Y" })).toEqual({
      ok: false,
      error: "unsupported_dimension",
    });
  });

  it("keeps GB, NI, Ireland, and all-island distinct", () => {
    expect(resolveOperationalGeography("GB").ok).toBe(true);
    expect(resolveOperationalGeography("NI")).toEqual({ ok: true, geography_id: "NI" });
    expect(resolveOperationalGeography("IE")).toEqual({ ok: true, geography_id: "IE" });
    expect(resolveOperationalGeography("ALL_ISLAND")).toEqual({ ok: true, geography_id: "ALL_ISLAND" });
    expect(releaseGeographies(release).sort()).toEqual(["ALL_ISLAND", "IE", "NI"]);
  });

  it("does not add GB and NI", () => {
    expect(combineOperationalGeographies(["GB", "NI"])).toEqual({ ok: false, error: "unsupported_dimension" });
    expect(combineOperationalGeographies(["NI", "GB"])).toEqual({ ok: false, error: "unsupported_dimension" });
    expect(combineOperationalGeographies(["GB", "NI", "IE"])).toEqual({
      ok: false,
      error: "unsupported_dimension",
    });
    expect(queryNorthernIreland(release, "GB,NI").status).toBe(400);
    expect(queryNorthernIreland(release, "UK")).toEqual({
      status: 400,
      body: { error: "unsupported_dimension" },
    });
    const ni = queryNorthernIreland(release, "NI");
    expect(ni.status).toBe(200);
    if (ni.status === 200) {
      expect(ni.body.series.every((series) => series.geography_id === "NI")).toBe(true);
      expect(ni.body.series.some((series) => series.geography_id === "GB")).toBe(false);
    }
  });

  it("has no GB plus NI sum in the source", () => {
    const root = resolve(process.cwd(), "src");
    const offenders: string[] = [];
    for (const file of walk(root)) {
      const text = readFileSync(file, "utf8");
      if (/GB\s*\+\s*NI|NI\s*\+\s*GB|gbMw\s*\+\s*niMw|niMw\s*\+\s*gbMw/.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
    expect(EIRGRID_TINYBIRD_OPS).toBe(0);
  });
});

describe("Northern Ireland page model", () => {
  it("uses the empty sentence when SONI has not arrived", () => {
    const model = buildNiPage(null, "Supported by EirGrid Group Data");
    expect(pageStatus(model)).toBe(
      "Grid does not have Northern Ireland data yet. It will appear here once SONI data is added.",
    );
    expect(model.scopes).toEqual([]);
  });

  it("states the latest SONI time and keeps euro as published", () => {
    const model = buildNiPage(release, "Supported by EirGrid Group Data");
    expect(model.available).toBe(true);
    expect(model.partial).toBe(false);
    expect(pageStatus(model)).toMatch(/^Latest data from SONI is from .+\.$/);
    expect(releaseContainsSterling(release)).toBe(false);
    const all = model.scopes.find((scope) => scope.id === "all");
    const price = all?.semo.find((figure) => figure.metricId === "elec.all_island.price.imbalance");
    expect(price?.value.startsWith("€")).toBe(true);
    expect(price?.value).not.toContain("£");
    const fuels = model.scopes.find((scope) => scope.id === "ni")?.fuels ?? [];
    const shares = fuels.map((row) => Number(row.share?.replace("%", "")));
    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(100);
    const laterForecast = {
      ...release,
      series: release.series.map((series) =>
        series.metric_id === "elec.ni.generation.wind_forecast"
          ? { ...series, points: [...series.points, { time: "2026-10-16T00:00:00.000Z", value: 1 }] }
          : series,
      ),
    };
    expect(buildNiPage(laterForecast, "Supported by EirGrid Group Data").status).toBe(model.status);
  });

  it("omits fuel shares when the fuels are not on the same interval", () => {
    const staggered = {
      ...release,
      series: release.series.map((series) => {
        if (series.metric_id !== "elec.ni.fuel.gas") {
          return series;
        }
        const newest = [...series.points].reverse().find((point) => point.value != null);
        if (!newest) {
          return series;
        }
        return {
          ...series,
          points: series.points.map((point) => (point.time === newest.time ? { ...point, value: null } : point)),
        };
      }),
    };
    const fuels = buildNiPage(staggered, "Supported by EirGrid Group Data").scopes.find((scope) => scope.id === "ni")?.fuels ?? [];
    expect(fuels.every((row) => row.share == null)).toBe(true);
    expect(fuels.find((row) => row.metricId === "elec.ni.fuel.gas")?.mwh).toBe("—");
  });

  it("uses the partial sentence when a Northern Ireland series is missing", () => {
    const partial = {
      ...release,
      series: release.series.filter((series) => series.metric_id !== "elec.ni.generation.solar"),
    };
    const model = buildNiPage(partial, "Supported by EirGrid Group Data");
    expect(pageStatus(model)).toBe(
      "Some of Northern Ireland's data is missing for this period. Totals may be lower than the full figure.",
    );
  });
});

describe("data sources", () => {
  it("lists the EirGrid Group licence URL", () => {
    const source = cataloguePageSources().find((row) => row.id === "eirgrid-group");
    expect(source?.licenceUrl).toBe(EIRGRID_GROUP_LICENCE_URL);
    expect(source?.attribution).toBe("Supported by EirGrid Group Data");
    expect(NI_FLOW_NOTE).toBe("Flows to and from Northern Ireland. NI figures are on a separate page.");
  });
});

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
      continue;
    }
    if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}
