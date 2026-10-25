import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { setBlobReadbackSleepForTests } from "@/lib/blob-readback";
import { MemoryPowerCutsStore, publishSnapshot, powerCutsArchivePath } from "@/lib/power-cuts/blob";
import { fetchBounded } from "@/lib/power-cuts/fetch";
import { mergeSnapshot, powerCutsFlags, fetchSource } from "@/lib/power-cuts/collect";
import { buildFixtureSnapshot } from "@/lib/power-cuts/fixture";
import { irishGridToWgs84 } from "@/lib/power-cuts/irish-grid";
import { areaTable, buildPowerCutsModel, outwardQuery } from "@/lib/power-cuts/model";
import { loadPowerCutsHealth } from "@/lib/power-cuts/health";
import { loadOfgemCiCml } from "@/lib/power-cuts/ofgem";
import { parseEnw, parseNged, parseNie, parseNpg, parseSpen, parseSsen, parseUkpn } from "@/lib/power-cuts/parse";
import { formatGrouped } from "@/lib/format/quantity";
import { FETCH_MAX_RETRIES, FETCH_TIMEOUT_MS, OPERATORS, type PowerCut, type PowerCutsSnapshot } from "@/lib/power-cuts/schema";

const dir = join(process.cwd(), "tests/fixtures/power-cuts");
const now = new Date("2026-10-25T18:00:00.000Z");

function read(name: string): string {
  return readFileSync(join(dir, name), "utf8");
}

describe("power cut parsers", () => {
  it("drops UKPN restored and Multiple rows and keeps a published zero", () => {
    const rows = parseUkpn(JSON.parse(read("ukpn.json")));
    expect(rows.map((row) => row.id)).toEqual(["ukpn:INCD-466033-G", "ukpn:INCD-27268-O"]);
    expect(rows[0]).toMatchObject({
      area: "SPN",
      nation: "England",
      kind: "unplanned",
      customersOff: 4,
      postcodes: ["TW1 1", "TW1 3"],
      point: [-0.32686, 51.45742],
    });
    expect(rows[1]).toMatchObject({ area: "EPN", kind: "planned", customersOff: 0, point: null });
  });

  it("dedupes Northern Powergrid postcode rows and does not sum customers", () => {
    const rows = parseNpg(JSON.parse(read("npg.json")));
    expect(rows).toHaveLength(3);
    const north = rows.find((row) => row.id === "npg:A000ca876INCD");
    expect(north?.customersOff).toBe(150);
    expect(north?.postcodes).toEqual(["DH8 6RD", "DH8 7PJ"]);
    expect(north?.area).toBe("NE");
    const planned = rows.find((row) => row.id === "npg:PPCR80589");
    expect(planned).toMatchObject({ kind: "planned", area: "YORKS", customersOff: 6 });
  });

  it("drops a restored NGED row and ignores a non-postcode token", () => {
    const csv = `${read("nged.csv")}\n"2026-10-25T19:10:00","South West","INCD-restored","4","0","4","Restored","false","HV","COMP","2026-10-25T01:00:00","","HV","51","-2","TA1 1AA"\n`;
    const rows = parseNged(csv);
    expect(rows.map((row) => row.id)).not.toContain("nged:INCD-restored");
    expect(rows).toHaveLength(4);
    const southWest = rows.find((row) => row.id === "nged:INCD-111594-l");
    expect(southWest?.postcodes).toEqual(["TA19 9ED", "TA19 9JB", "TA19 9EB"]);
    expect(southWest?.customersOff).toBe(0);
    expect(rows.find((row) => row.area === "SWALES")?.nation).toBe("Wales");
    expect(rows.find((row) => row.id === "nged:INCD-78627-m")?.estimatedRestorationAt).toBeNull();
  });

  it("drops restored ENW rows", () => {
    const rows = parseEnw(JSON.parse(read("enw.json")));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "enw:ENW-1001",
      customersOff: 9,
      kind: "unplanned",
      area: "ENW",
      point: [-2.24, 53.48],
    });
  });

  it("keeps SPEN customer counts null and places SPM from the postcode", () => {
    const lookup = (label: string) => {
      const points: Record<string, [number, number]> = {
        "G1 2": [-4.25, 55.86],
        "LL11 1": [-3, 53.05],
        "L1 1": [-2.98, 53.4],
      };
      return points[label] ?? null;
    };
    const rows = parseSpen(JSON.parse(read("spen.json")), lookup);
    expect(rows.map((row) => row.id).sort()).toEqual(["spen:SPD-1", "spen:SPM-1", "spen:SPM-2"]);
    expect(rows.every((row) => row.customersOff === null)).toBe(true);
    expect(rows.find((row) => row.id === "spen:SPM-1")).toMatchObject({ nation: "Wales", area: "SPM", point: [-3, 53.05] });
    expect(rows.find((row) => row.id === "spen:SPM-2")).toMatchObject({
      nation: "England",
      kind: "planned",
      startedAt: "2026-10-25T05:00:00.000Z",
    });
    expect(rows.find((row) => row.id === "spen:SPD-1")?.nation).toBe("Scotland");
  });

  it("parses SSEN network ids and drops a resolved fault", () => {
    const payload = JSON.parse(read("ssen.json")) as { Faults: Array<Record<string, unknown>> };
    payload.Faults.push({ ...payload.Faults[0], reference: "RESOLVED", resolved: true });
    const rows = parseSsen(payload);
    expect(rows.map((row) => row.id)).toEqual(["ssen:UE6960", "ssen:UF0211"]);
    expect(rows[0]).toMatchObject({ area: "SEPD", nation: "England", customersOff: 7, kind: "unplanned" });
    expect(rows[1]).toMatchObject({ area: "SHEPD", nation: "Scotland", customersOff: 6 });
    expect(rows[0]?.startedAt).toBe("2026-10-23T09:47:00.000Z");
  });

  it("converts NIE Irish Grid and display times", () => {
    const point = irishGridToWgs84(285738.385, 439743.166);
    expect(point).not.toBeNull();
    expect(point?.[0]).toBeGreaterThan(-8.5);
    expect(point?.[0]).toBeLessThan(-5.3);
    expect(point?.[1]).toBeGreaterThan(54);
    expect(point?.[1]).toBeLessThan(55.5);
    const rows = parseNie(JSON.parse(read("nie.json")), now);
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.area === "NI" && row.nation === "Northern Ireland" && row.kind === "unplanned")).toBe(true);
    expect(rows[0]?.customersOff).toBe(1);
    expect(rows[2]?.startedAt).toBe("2026-10-24T12:32:00.000Z");
    expect(rows[2]?.estimatedRestorationAt).toBeNull();
    expect(rows[1]?.startedAt).toBe("2026-10-25T07:30:00.000Z");
    expect(rows[1]?.estimatedRestorationAt).toBe("2026-10-25T23:30:00.000Z");
    expect(rows[0]?.point).toEqual(point);
  });
});

describe("power cut reconciliation", () => {
  it("sums area rows to the headline", () => {
    const model = buildPowerCutsModel(buildFixtureSnapshot(), now);
    const areas = model.rows.filter((row) => row.row === "area");
    const uk = model.rows.find((row) => row.row === "uk");
    expect(areas.reduce((sum, row) => sum + row.incidents, 0)).toBe(uk?.incidents);
    expect(areas.reduce((sum, row) => sum + row.incidents, 0)).toBe(model.incidents);
    expect(areas.reduce((sum, row) => sum + (row.customersShown ?? 0), 0)).toBe(uk?.customersShown);
    expect(model.unplannedPercent + model.plannedPercent).toBe(100);
    expect(model.coverage).not.toMatch(/all of the UK|the whole UK/i);
    expect(model.coverage).toContain("not licensed");
    expect(model.freshness).toBe("partial");
    expect(outwardQuery(["SW10 0AA", "TW1 1"], "SW1")).toBe(false);
    expect(outwardQuery(["SW1A 1AA", "TW1 1"], "SW1")).toBe(true);
    expect(outwardQuery(["TW1 1"], "TW")).toBe(true);
  });

  it("keeps a 1,000-customer area numeric until render", () => {
    const cut = (id: string, area: PowerCut["area"], nation: PowerCut["nation"], customersOff: number): PowerCut => ({
      id,
      operator: area === "SWALES" ? "nged" : "ukpn",
      area,
      nation,
      kind: "unplanned",
      status: "active",
      startedAt: "2026-10-25T12:00:00.000Z",
      estimatedRestorationAt: null,
      customersOff,
      postcodes: [],
      point: null,
      sourceUrl: "https://example.test/cuts",
    });
    const rows = areaTable([cut("ukpn:a", "EPN", "England", 1000), cut("nged:b", "SWALES", "Wales", 1)]);
    const areas = rows.filter((row) => row.row === "area");
    const uk = rows.find((row) => row.row === "uk");
    expect(areas.map((row) => row.customersShown)).toEqual([1000, 1]);
    expect(areas.reduce((sum, row) => sum + (row.customersShown ?? 0), 0)).toBe(1001);
    expect(uk?.customersShown).toBe(1001);
    expect(formatGrouped(uk?.customersShown ?? 0, 0)).toBe("1,001");
  });

});

describe("stale and absent", () => {
  const previous = (): PowerCutsSnapshot => buildFixtureSnapshot();

  it("keeps the last good rows until they are two hours old", () => {
    const prior = previous();
    const failed = OPERATORS.map((operator) =>
      operator === "ukpn"
        ? { operator, status: "absent" as const, incidents: [], error: "HTTP 500" }
        : { operator, status: prior.sources[operator].status === "unlicensed" ? ("unlicensed" as const) : prior.sources[operator].status === "ok" ? ("ok" as const) : ("absent" as const), incidents: prior.incidents.filter((row) => row.operator === operator), error: prior.sources[operator].error },
    );
    const merged = mergeSnapshot(failed, prior, new Date("2026-10-25T20:00:00.000Z"));
    expect(merged.sources.ukpn.status).toBe("stale");
    expect(merged.incidents.some((row) => row.operator === "ukpn")).toBe(true);
    expect(merged.sources.ukpn.fetchedAt).toBe(prior.sources.ukpn.fetchedAt);
  });

  it("drops rows once the last good read is two hours old", () => {
    const prior = previous();
    const failed = OPERATORS.map((operator) => ({
      operator,
      status: prior.sources[operator].status === "unlicensed" ? ("unlicensed" as const) : ("absent" as const),
      incidents: [],
      error: prior.sources[operator].error ?? "HTTP 500",
    }));
    const merged = mergeSnapshot(failed, prior, new Date("2026-10-25T22:00:00.000Z"));
    expect(merged.sources.ukpn.status).toBe("absent");
    expect(merged.incidents.some((row) => row.operator === "ukpn")).toBe(false);
  });

  it("does not keep rows when the API key is missing", () => {
    const prior = previous();
    prior.sources.enw = { status: "ok", fetchedAt: prior.fetchedAt, count: 1 };
    prior.incidents.push({
      ...prior.incidents[0]!,
      id: "enw:old",
      operator: "enw",
      area: "ENW",
    });
    const fetched = OPERATORS.map((operator) =>
      operator === "enw"
        ? { operator, status: "absent" as const, incidents: [], error: "API key not configured" }
        : { operator, status: "ok" as const, incidents: prior.incidents.filter((row) => row.operator === operator) },
    );
    const merged = mergeSnapshot(fetched, prior, now);
    expect(merged.sources.enw).toMatchObject({ status: "absent", error: "API key not configured" });
    expect(merged.incidents.some((row) => row.operator === "enw")).toBe(false);
  });
});

describe("fetch bounds", () => {
  it("uses a 10s timeout and at most two retries", () => {
    expect(FETCH_TIMEOUT_MS).toBe(10_000);
    expect(FETCH_MAX_RETRIES).toBe(2);
  });

  it("retries a 500 twice and then returns the body", async () => {
    let calls = 0;
    const sleeps: number[] = [];
    const body = await fetchBounded("https://example.test/cuts", {
      jitter: () => 0,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      fetchImpl: async (_url, init) => {
        calls += 1;
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        if (calls < 3) {
          return new Response("no", { status: 500 });
        }
        return new Response("ok", { status: 200 });
      },
    });
    expect(body).toBe("ok");
    expect(calls).toBe(3);
    expect(sleeps).toEqual([200, 800]);
  });

  it("does not retry a 400", async () => {
    let calls = 0;
    await expect(
      fetchBounded("https://example.test/cuts", {
        fetchImpl: async () => {
          calls += 1;
          return new Response("no", { status: 400 });
        },
      }),
    ).rejects.toThrow("HTTP 400");
    expect(calls).toBe(1);
  });

  it("does not fetch ENW or SSEN when they are disabled", async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return new Response("[]", { status: 200 });
    };
    const flags = powerCutsFlags({ NODE_ENV: "test" });
    const enw = await fetchSource("enw", flags, now, fetchImpl);
    const ssen = await fetchSource("ssen", flags, now, fetchImpl);
    expect(enw).toMatchObject({ status: "absent", error: "API key not configured" });
    expect(ssen).toMatchObject({ status: "unlicensed", error: "Not licensed" });
    expect(calls).toBe(0);
  });
});

describe("blob publish", () => {
  it("reads the latest object back and prunes archives older than 30 days", async () => {
    setBlobReadbackSleepForTests(async () => {});
    const store = new MemoryPowerCutsStore();
    const snapshot = buildFixtureSnapshot();
    const when = new Date("2026-10-25T19:10:00.000Z");
    await store.put("power-cuts/2026/09/01/00.json", "{}", true);
    await publishSnapshot(snapshot, when, store);
    expect(store.files.get("power-cuts/latest.json")?.body).toBe(JSON.stringify(snapshot));
    expect(store.files.has(powerCutsArchivePath(when))).toBe(true);
    expect(store.files.has("power-cuts/2026/09/01/00.json")).toBe(false);
    setBlobReadbackSleepForTests(null);
  });
});

describe("ofgem context", () => {
  it("uses the published 2024/25 sheet values", () => {
    const data = loadOfgemCiCml();
    expect(data?.rows[0]).toMatchObject({ label: "SP ENW", ci: 26.07, ci_target: 29.74, cml: 27.09, cml_target: 26.87 });
    expect(data?.rows).toHaveLength(14);
    expect(data?.attribution).toBe("Contains Ofgem data licensed under the Open Government Licence v3.0.");
    expect(data?.ci_unit).toBe("interruptions per 100 customers");
    expect(data?.cml_unit).toBe("minutes");
  });
});

describe("feed shape", () => {
  const flags = powerCutsFlags({ NODE_ENV: "test" });

  it("rejects an HTML page and an object, and accepts an empty array or a header-only CSV", async () => {
    const html = await fetchSource(
      "nged",
      flags,
      now,
      async () => new Response("<html>maintenance</html>", { status: 200 }),
    );
    expect(html).toMatchObject({ status: "absent", incidents: [] });
    const prior = buildFixtureSnapshot();
    const merged = mergeSnapshot(
      OPERATORS.map((operator) =>
        operator === "nged"
          ? html
          : {
              operator,
              status:
                prior.sources[operator].status === "unlicensed"
                  ? ("unlicensed" as const)
                  : prior.sources[operator].status === "absent"
                    ? ("absent" as const)
                    : ("ok" as const),
              incidents: prior.incidents.filter((row) => row.operator === operator),
              error: prior.sources[operator].error,
            },
      ),
      prior,
      new Date("2026-10-25T19:30:00.000Z"),
    );
    expect(merged.sources.nged.status).toBe("stale");
    expect(merged.incidents.some((row) => row.operator === "nged")).toBe(true);

    const empty = await fetchSource("ukpn", flags, now, async () => new Response("[]", { status: 200 }));
    expect(empty).toMatchObject({ status: "ok", incidents: [] });
    const header =
      '"Region","Incident ID","Confirmed Off","Status","Planned","Start Time","ETR","Location Latitude","Location Longitude","Postcodes"\n';
    const csv = await fetchSource("nged", flags, now, async () => new Response(header, { status: 200 }));
    expect(csv).toMatchObject({ status: "ok", incidents: [] });
    const object = await fetchSource("ukpn", flags, now, async () => new Response("{}", { status: 200 }));
    expect(object.status).toBe("absent");
  });
});

describe("health age", () => {
  it("marks an old ok source stale and shows the fetch time", async () => {
    const fresh = await loadPowerCutsHealth(new Date("2026-10-25T19:20:00.000Z"));
    expect(fresh.sources.find((source) => source.operator === "ukpn")).toMatchObject({
      status: "ok",
      fetchedAt: "2026-10-25T19:10:00.000Z",
    });
    const aged = await loadPowerCutsHealth(new Date("2026-10-25T20:00:00.000Z"));
    expect(aged.sources.find((source) => source.operator === "ukpn")?.status).toBe("stale");
    expect(aged.sources.find((source) => source.operator === "enw")?.status).toBe("absent");
    expect(aged.sources.find((source) => source.operator === "ssen")?.status).toBe("unlicensed");
  });
});

function walk(dir: string): string {
  return readdirSync(dir)
    .map((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        return walk(path);
      }
      if (name.endsWith(".test.ts")) {
        return "";
      }
      return readFileSync(path, "utf8");
    })
    .join("\n");
}

describe("power cuts has no Tinybird query", () => {
  it("does not call queryPipe", () => {
    const text = [
      "src/lib/power-cuts",
      "src/app/power-cuts",
      "src/app/api/cron-power-cuts",
      "src/components/power-cuts",
    ]
      .map((dir) => walk(join(process.cwd(), dir)))
      .join("\n");
    expect(text).not.toContain("queryPipe");
  });
});
