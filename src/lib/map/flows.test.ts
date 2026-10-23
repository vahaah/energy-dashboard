import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { capacityFromRegister, capacityRowsFromCkan } from "@/lib/map/capacity";
import { compactElectricity } from "@/lib/map/electricity-release";
import {
  ELECTRICITY_BANNER_STALE_MS,
  ELECTRICITY_STALE_MS,
  flowDirectionMoves,
  flowListLine,
  GAS_STALE_MS,
  electricityDirectionWords,
  electricityWidthPx,
  formatFlowReading,
  gasDirectionWords,
  gasWidthPx,
  ZERO_FLOW_LABEL,
  netGasLabel,
  readingIsStale,
} from "@/lib/map/flow-scale";
import { FLOWS_HTML_BUDGET_BYTES, buildFlowsPageModel, catalogueFlowsInput, flowsModelBytes } from "@/lib/map/flows-model";
import { flowSelectionFromQuery } from "@/lib/map/flows-selection";
import { fixtureMapFlows } from "@/lib/map/flows-fixture";
import {
  MAP_FLOWS_ELECTRICITY,
  MAP_FLOWS_GAS,
  MAP_FLOWS_LATEST,
  readMapFlowsRelease,
  writeMapElectricityPointer,
  writeMapGasPointer,
} from "@/lib/map/flows-release";
import { sparklinePath } from "@/lib/map/sparkline";
import { STALE_CLOCK_INTERVAL_MS, startStaleClock } from "@/lib/map/stale-clock";
import { MemoryGasStore, setGasStoreForTests } from "@/lib/gas/blob";
import { OGL_V3_ATTRIBUTION } from "@/lib/attribution";
import { parseInstantaneousFlows } from "@/lib/map/gas-terminal-flows";
import { ABSENT_FIGURE } from "@/lib/data-state";
import { loadAssetCatalogue } from "@/lib/assets/load";
import { stationsFromPoints } from "@/lib/map/stations-layer";

describe("flow direction, width, and staleness", () => {
  it("names electricity and gas direction in words and leaves a missing reading blank", () => {
    expect(electricityDirectionWords(10)).toBe("Into GB");
    expect(electricityDirectionWords(-10)).toBe("Out of GB");
    expect(electricityDirectionWords(0)).toBeNull();
    expect(electricityDirectionWords(null)).toBeNull();
    expect(gasDirectionWords("entry", 12)).toBe("Into GB");
    expect(gasDirectionWords("exit", 12)).toBe("Out of GB");
    expect(gasDirectionWords("entry", 0)).toBe(ZERO_FLOW_LABEL);
    expect(gasDirectionWords("exit", 0)).toBe(ZERO_FLOW_LABEL);
    expect(gasDirectionWords("entry", null)).toBeNull();
    expect(flowDirectionMoves(ZERO_FLOW_LABEL)).toBe(false);
    expect(flowDirectionMoves("Into GB")).toBe(true);
    expect(flowDirectionMoves(null)).toBe(false);
    expect(flowListLine(ZERO_FLOW_LABEL, "0.0 mcm/d")).toBe("Zero flow · 0.0 mcm/d");
    expect(formatFlowReading(null, "MW")).toBe(ABSENT_FIGURE);
    expect(formatFlowReading(0, "MW")).toBe("0 MW");
    expect(flowListLine(null, "0.0 mcm/d")).toBe("0.0 mcm/d");
    expect(flowListLine(null, ABSENT_FIGURE)).toBe(ABSENT_FIGURE);
    expect(flowListLine("Into GB", "12.0 mcm/d")).toBe("Into GB · 12.0 mcm/d");
  });

  it("uses the 2, 4 and 6 pixel steps", () => {
    expect(electricityWidthPx(499)).toBe(2);
    expect(electricityWidthPx(500)).toBe(4);
    expect(electricityWidthPx(1000)).toBe(4);
    expect(electricityWidthPx(1001)).toBe(6);
    expect(electricityWidthPx(null)).toBeNull();
    expect(gasWidthPx(19.9)).toBe(2);
    expect(gasWidthPx(20)).toBe(4);
    expect(gasWidthPx(50)).toBe(4);
    expect(gasWidthPx(50.1)).toBe(6);
    expect(gasWidthPx(null)).toBeNull();
  });

  it("goes stale after 60 minutes of electricity and 2 hours of gas", () => {
    const now = new Date("2026-10-20T12:00:00.000Z");
    expect(readingIsStale("2026-10-20T11:00:00.000Z", now, ELECTRICITY_STALE_MS)).toBe(false);
    expect(readingIsStale("2026-10-20T10:59:00.000Z", now, ELECTRICITY_STALE_MS)).toBe(true);
    expect(readingIsStale("2026-10-20T10:00:00.000Z", now, GAS_STALE_MS)).toBe(false);
    expect(readingIsStale("2026-10-20T09:59:00.000Z", now, GAS_STALE_MS)).toBe(true);
    expect(readingIsStale(null, now, ELECTRICITY_STALE_MS)).toBe(false);
    expect(ELECTRICITY_STALE_MS).toBe(60 * 60 * 1000);
    expect(GAS_STALE_MS).toBe(2 * 60 * 60 * 1000);
    expect(ELECTRICITY_BANNER_STALE_MS).toBe(90 * 60 * 1000);
    expect(readingIsStale("2026-10-20T10:50:00.000Z", now, ELECTRICITY_BANNER_STALE_MS)).toBe(false);
    expect(readingIsStale("2026-10-20T10:29:00.000Z", now, ELECTRICITY_BANNER_STALE_MS)).toBe(true);
  });
});

describe("map flows model", () => {
  it("keeps the default payload under 20 KB and does not zero a missing reading", () => {
    const now = new Date("2026-10-20T08:00:00.000Z");
    const fixture = fixtureMapFlows(now);
    const model = buildFlowsPageModel({
      ...catalogueFlowsInput(),
      ...fixture,
    });
    expect(flowsModelBytes(model)).toBeLessThanOrEqual(FLOWS_HTML_BUDGET_BYTES);
    expect(model.features.map((feature) => feature.latitude)).toEqual(
      [...model.features].sort((left, right) => right.latitude - left.latitude).map((feature) => feature.latitude),
    );
    const missing = model.features.find((feature) => feature.name === "Greenlink");
    expect(missing?.reading).toBe(ABSENT_FIGURE);
    expect(missing?.value).toBeNull();
    expect(missing?.width).toBeNull();
    const moyle = model.features.find((feature) => feature.name === "Moyle");
    expect(moyle?.counterparty).toBe("Northern Ireland, outside GB");
    expect(moyle?.counterpartyOutsideGb).toBe(true);
    expect(model.straightLine).toBe("Straight line, not the cable route.");
    expect(model.title).toBe("Flows across GB borders");
    const stationsCredit = model.credits.find((credit) => credit.id === "stations");
    expect(stationsCredit?.layer).toBe("stations");
    expect(stationsCredit?.text).toContain("REPD");
    expect(stationsCredit?.text).toContain("DUKES");
    expect(stationsCredit?.text).toContain("DESNZ");
    expect(stationsCredit?.text).toContain(OGL_V3_ATTRIBUTION);
    expect(model.gasMissing).toBe(0);
    expect(model.netGasMcm).not.toBeNull();
    expect(JSON.stringify(model)).not.toMatch(/\blive\b/i);
    expect(JSON.stringify(model)).not.toMatch(/real-time/i);
  });

  it("builds station points without embedding them in the map page", () => {
    const collection = stationsFromPoints(loadAssetCatalogue().rows);
    expect(collection.features.length).toBeGreaterThan(3000);
    expect(collection.features.every((feature) => feature.properties.radius === 5 || feature.properties.radius === 9 || feature.properties.radius === 14)).toBe(true);
    expect(readFileSync(resolve(process.cwd(), "src/app/map/page.tsx"), "utf8")).not.toContain("stationsFromPoints");
    expect(readFileSync(resolve(process.cwd(), "src/components/flows-map.tsx"), "utf8")).not.toContain("symbols");
    const filtered = stationsFromPoints([
      { id: "gb", name: "A", technology: "ccgt", country: "England", mw: 10, latitude: 51, longitude: 0.1 },
      { id: "ni", name: "B", technology: "ccgt", country: "Northern Ireland", mw: 400, latitude: 54.6, longitude: -6 },
      { id: "blank", name: "C", technology: "onshore_wind", country: "Scotland", mw: null, latitude: 56, longitude: -4 },
      { id: "link", name: "D", technology: "interconnector", country: "Wales", mw: 1000, latitude: 51.5, longitude: -3 },
    ]);
    expect(filtered.features).toEqual([
      expect.objectContaining({
        properties: expect.objectContaining({ id: "gb", group: "gas", shape: "circle", radius: 5 }),
      }),
    ]);
  });

  it("does not query Tinybird from the map page", () => {
    const files = [
      "src/app/map/page.tsx",
      "src/components/flows-map.tsx",
      "src/lib/map/flows-browser.ts",
      "src/lib/map/load-flows.ts",
      "src/lib/map/flows-release.ts",
    ];
    for (const file of files) {
      const text = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(text).not.toContain("queryPipe");
      expect(text).not.toContain("/api/interconnectors");
      expect(text).not.toContain("tinybird.co");
    }
  });
});

describe("gas terminals and NESO capacity", () => {
  it("keeps parent terminal totals and ignores a child entry and a rejected quality", () => {
    const parsed = parseInstantaneousFlows({
      publishedTime: "2026-10-20T08:00:00Z",
      instantaneousFlow: [
        {
          description: "Supply from entry points",
          sites: [{ siteName: "BACTON PERENCO", siteGasDetail: [{ applicableAt: "2026-10-20T08:00:00Z", flowRate: 7, qualityIndicator: "" }] }],
        },
        {
          description: "Supply from terminals",
          sites: [
            { siteName: "BACTON UKCS Terminal", siteGasDetail: [{ applicableAt: "2026-10-20T08:00:00Z", flowRate: 11.5, qualityIndicator: "" }] },
            { siteName: "THEDDLETHORPE TERMINAL", siteGasDetail: [{ applicableAt: "2026-10-20T08:00:00Z", flowRate: 1, qualityIndicator: "E" }] },
          ],
        },
        {
          description: "Demand from interconnectors",
          sites: [{ siteName: "Moffat Export", siteGasDetail: [{ applicableAt: "2026-10-20T08:00:00Z", flowRate: 13, qualityIndicator: "A" }] }],
        },
      ],
    });
    expect(parsed.samples.map((sample) => sample.key)).toEqual(["bacton-ukcs", "moffat"]);
  });

  it("keeps the larger built stage and reads numeric strings", () => {
    const release = capacityFromRegister(
      capacityRowsFromCkan([
        { "Project Name": "Auchencrosh (interconnector CCT)", "Project Status": "Built", "Connection Site": "Auchencrosh 275kV", "MW Import - Current": "270.0", "MW Export - Current": "500.0" },
        { "Project Name": "Auchencrosh (interconnector CCT)", "Project Status": "Built", "Connection Site": "Auchencrosh 275kV", "MW Import - Current": "475.0", "MW Export - Current": "500.0" },
        { "Project Name": "Isle of Man Interconnector", "Project Status": "Built", "Connection Site": "Bispham", "MW Import - Current": "74", "MW Export - Current": "74" },
      ]),
      new Date("2026-10-20T00:00:00.000Z"),
      "2026-10-20T00:00:00.000Z",
    );
    expect(release.rows).toEqual([
      expect.objectContaining({ code: "INTIRL", importMw: 475, exportMw: 500 }),
    ]);
  });

  it("compacts the warmed envelope without treating a lowercase code as missing", () => {
    const release = compactElectricity(
      [
        { timestamp: "2026-10-20T07:00:00.000Z", interconnector: "intfr", generation_mw: 100, direction: "import" },
        { timestamp: "2026-10-20T08:00:00.000Z", interconnector: "intfr", generation_mw: 250, direction: "import" },
        { timestamp: "2026-10-20T08:00:00.000Z", interconnector: "intneso", generation_mw: 10, direction: "import" },
      ],
      new Date("2026-10-20T08:05:00.000Z"),
    );
    expect(release.series).toHaveLength(1);
    expect(release.series[0]?.code).toBe("INTFR");
    expect(release.series[0]?.latestMw).toBe(250);
  });
});

describe("flows map review fixes", () => {
  afterEach(() => {
    setGasStoreForTests(null);
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("restores ?sel= and layers=ic from asset pages", () => {
    expect(
      flowSelectionFromQuery({ sel: "ast_5c5dc7c6656c3f93", asset: null, layers: "ic" }),
    ).toEqual({ selectedId: "ast_5c5dc7c6656c3f93", interconnectors: true });
    expect(flowSelectionFromQuery({ sel: null, asset: "ast_station", layers: "" })).toEqual({
      selectedId: "ast_station",
      interconnectors: true,
    });
    expect(flowSelectionFromQuery({ sel: null, asset: null, layers: "dno" })).toEqual({
      selectedId: null,
      interconnectors: false,
    });
    const source = readFileSync(resolve(process.cwd(), "src/components/flows-map.tsx"), "utf8");
    expect(source).toContain("useQueryStates(mapViewParsers");
    expect(source).toContain("flowSelectionFromQuery");
    expect(source).toContain("stationsRef");
    expect(source).toContain("chooseRef.current(id, null)");
  });

  it("ticks the staleness clock each minute and pauses while hidden", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T12:00:00.000Z"));
    let hidden = false;
    const ticks: number[] = [];
    let onChange = (): void => undefined;
    const stop = startStaleClock({
      onTick: (now) => ticks.push(now),
      hidden: () => hidden,
      subscribeVisibility: (listener) => {
        onChange = listener;
        return () => {
          onChange = () => undefined;
        };
      },
    });
    expect(ticks).toEqual([Date.parse("2026-10-20T12:00:00.000Z")]);
    vi.advanceTimersByTime(STALE_CLOCK_INTERVAL_MS);
    expect(ticks).toHaveLength(2);
    hidden = true;
    onChange();
    vi.advanceTimersByTime(STALE_CLOCK_INTERVAL_MS * 3);
    expect(ticks).toHaveLength(2);
    hidden = false;
    onChange();
    expect(ticks).toHaveLength(3);
    vi.advanceTimersByTime(STALE_CLOCK_INTERVAL_MS);
    expect(ticks).toHaveLength(4);
    stop();
    vi.advanceTimersByTime(STALE_CLOCK_INTERVAL_MS);
    expect(ticks).toHaveLength(4);
    const source = readFileSync(resolve(process.cwd(), "src/components/flows-map.tsx"), "utf8");
    expect(source).toContain("startStaleClock");
    expect(source).toContain("document.hidden");
  });

  it("keeps electricity when gas publishes to its own pointer", async () => {
    const store = new MemoryGasStore();
    const reads: string[] = [];
    const get = store.get.bind(store);
    store.get = (pathname: string) => {
      reads.push(pathname);
      return get(pathname);
    };
    setGasStoreForTests(store);
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
    const now = new Date("2026-10-20T08:00:00.000Z");
    const fixture = fixtureMapFlows(now);
    store.files.set(MAP_FLOWS_LATEST, {
      body: `${JSON.stringify({
        generated_at: now.toISOString(),
        electricity: fixture.electricity,
        gas: fixture.gas,
        capacity: fixture.capacity,
      })}\n`,
      uploadedAt: now,
    });
    const later = new Date("2026-10-20T09:00:00.000Z");
    const gasOnly = { ...fixture.gas, generated_at: later.toISOString(), samples: fixture.gas.samples.slice(0, 3) };
    reads.length = 0;
    await writeMapGasPointer(gasOnly, later);
    expect(reads.some((path) => path === MAP_FLOWS_ELECTRICITY || path === MAP_FLOWS_LATEST)).toBe(false);
    const duringGas = await readMapFlowsRelease();
    expect(duringGas?.electricity?.generated_at).toBe(now.toISOString());
    expect(duringGas?.gas?.generated_at).toBe(later.toISOString());
    expect(duringGas?.capacity?.rows.length).toBeGreaterThan(0);
    await writeMapElectricityPointer({ electricity: { ...fixture.electricity, generated_at: later.toISOString() } }, later);
    const split = await readMapFlowsRelease();
    expect(split?.electricity?.generated_at).toBe(later.toISOString());
    expect(split?.gas?.samples).toHaveLength(3);
    expect(split?.capacity?.rows.length).toBeGreaterThan(0);
    expect(store.files.get(MAP_FLOWS_ELECTRICITY)?.body).toContain("electricity");
    expect(store.files.get(MAP_FLOWS_GAS)?.body).toContain("gas");
    const legacy = store.files.get(MAP_FLOWS_LATEST)?.body ?? "";
    expect(legacy).toContain(now.toISOString());
  });

  it("breaks a sparkline at a null sample", () => {
    const path = sparklinePath([10, null, 30], 100, 10);
    expect(path).toBe("M 0 9 M 100 1");
    expect(path?.includes(" L ")).toBe(false);
    const joined = sparklinePath([10, 30], 100, 10);
    expect(joined).toBe("M 0 9 L 100 1");
  });

  it("omits the net gas total when a catalogue terminal has no sample", () => {
    const now = new Date("2026-10-20T08:00:00.000Z");
    const fixture = fixtureMapFlows(now);
    const full = buildFlowsPageModel({ ...catalogueFlowsInput(), ...fixture });
    expect(full.gasMissing).toBe(0);
    expect(full.netGasMcm).toBeCloseTo(154.4, 5);
    expect(netGasLabel(full.netGasMcm, full.gasMissing)).toBe("Net gas into GB 154.4 mcm/d (million m³/day)");
    const partial = buildFlowsPageModel({
      ...catalogueFlowsInput(),
      ...fixture,
      gas: { ...fixture.gas, samples: fixture.gas.samples.filter((sample) => sample.key !== "moffat") },
    });
    expect(partial.gasFlows).toBe("published");
    expect(partial.gasMissing).toBe(1);
    expect(partial.netGasMcm).toBeNull();
    expect(netGasLabel(partial.netGasMcm, partial.gasMissing)).toBe("Partial gas coverage, 1 terminal missing");
  });
});
