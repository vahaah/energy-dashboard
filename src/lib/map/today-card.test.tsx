import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TodayMapCardView } from "@/components/today-map-card";
import { OGL_V3_ATTRIBUTION } from "@/lib/attribution";
import {
  TODAY_MAP_CONSENT,
  TODAY_MAP_LIST,
  TODAY_MAP_MAX_BYTES,
  TODAY_MAP_OPEN,
  TODAY_MAP_PIPELINE_UNFILTERED,
  TODAY_MAP_SCOPE,
  TODAY_MAP_SUMMARY,
  TODAY_MAP_TITLE,
  addCalendarMonths,
  containsBannedTodayMapPhrase,
  registerEditionLabel,
  registerFreshness,
  repdQuarterEnd,
  todayMapAlt,
  todayMapReleaseCurrent,
  type TodayMapCardFile,
} from "@/lib/map/today-card";
import { renderTodayMapCard } from "@/lib/map/today-card-build";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("today map card", () => {
  const manifest = JSON.parse(source("src/lib/map/today-card.json")) as TodayMapCardFile;
  const card = source("src/components/today-map-card.tsx");
  const dashboard = source("src/components/dashboard.tsx");
  const home = source("src/app/page.tsx");

  it("keeps / force-static with revalidate 300", () => {
    expect(home).toContain('export const dynamic = "force-static"');
    expect(home).toContain("export const revalidate = 300");
    expect(card).not.toContain("queryPipe");
    expect(card).not.toContain("tinybird");
    expect(card).not.toContain("loadAssetCatalogue");
    expect(card).not.toContain("loadProjectCatalogue");
    expect(card).not.toContain("today-card-build");
    expect(card).not.toContain("static-map");
    expect(card).not.toContain("maplibre");
    expect(card).not.toContain("pmtiles");
    expect(card).not.toContain("blob.vercel-storage");
    expect(card).not.toContain('from "next/link"');
    expect(card).not.toContain("gray-700");
    expect(card).not.toContain("NESO_OPEN_DATA_ATTRIBUTION");
  });

  it("uses the register copy, the OGL credit, and a Great Britain alt count", () => {
    expect(TODAY_MAP_TITLE).toBe("Power infrastructure in GB");
    expect(TODAY_MAP_SUMMARY).toBe("What is built and what is in the pipeline, from the public registers.");
    expect(TODAY_MAP_SCOPE).toBe("England, Scotland and Wales.");
    expect(TODAY_MAP_CONSENT).toBe("Consent does not mean a project will be built.");
    expect(TODAY_MAP_OPEN).toBe("Open map →");
    expect(TODAY_MAP_LIST).toBe("View as list");
    expect(card).toContain("OGL_V3_ATTRIBUTION");
    expect(card).toContain("OGL_V3_LICENCE_URL");
    expect(card).toContain('loading="lazy"');
    expect(manifest.edition).toBe(registerEditionLabel("REPD Q2 2026", "May 2026"));
    expect(manifest.repd_quarter_end).toBe("2026-06-30");
    expect(manifest.dukes_published_on).toBe("2026-07-30");
    expect(manifest.alt).toBe(todayMapAlt(manifest.operating.sites ?? 0, manifest.operating.gw ?? "", ["Gas", "Offshore wind", "Onshore wind"]));
    expect(manifest.alt).toMatch(/^Map of Great Britain showing [\d,]+ operating power sites, \d+\.\d GW in total\. Gas, offshore wind and onshore wind are the largest by capacity\.$/);
    for (const text of [card, JSON.stringify(manifest), TODAY_MAP_TITLE, TODAY_MAP_SUMMARY, TODAY_MAP_OPEN, manifest.alt]) {
      expect(containsBannedTodayMapPhrase(text)).toBe(false);
      expect(text).not.toMatch(/\bUK\b/);
      expect(text).not.toMatch(/\blive\b/i);
      expect(text).not.toMatch(/real-time/i);
    }
  });

  it("links below the answer and headline", () => {
    expect(card).toContain('href="/map"');
    expect(card).toContain('href="/assets"');
    expect(card).toContain("focus-visible:ring-2");
    expect(card).toContain("focus-visible:ring-blue-700");
    expect(dashboard.indexOf("<TodayMapCard />")).toBeGreaterThan(dashboard.indexOf("answer={answer}"));
    expect(dashboard.indexOf("<TodayMapCard />")).toBeGreaterThan(dashboard.indexOf('id="section-overview"'));
    expect(dashboard.indexOf("<TodayMapCard />")).toBeLessThan(dashboard.indexOf('id="section-price"'));
  });

  it("commits 2× images at or under 25 KB", () => {
    expect(manifest.light).toBe("/today/map-light.png");
    expect(manifest.dark).toBe("/today/map-dark.png");
    expect(manifest.width).toBe(264 * 2);
    expect(manifest.height).toBeGreaterThan(manifest.width);
    for (const path of [manifest.light, manifest.dark]) {
      const bytes = statSync(resolve(`public${path}`)).size;
      expect(bytes).toBeLessThanOrEqual(TODAY_MAP_MAX_BYTES);
      const png = readFileSync(resolve(`public${path}`));
      expect(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
      expect(png.readUInt32BE(16)).toBe(manifest.width);
      expect(png.readUInt32BE(20)).toBe(manifest.height);
    }
  });

  it("regenerates only when the catalogue release changes and matches the committed bytes", () => {
    expect(
      todayMapReleaseCurrent(manifest, {
        repd_source_release_id: manifest.repd_source_release_id,
        dukes_source_release_id: manifest.dukes_source_release_id,
        dno_sha256: manifest.dno_sha256,
        batteries_sha256: manifest.batteries_sha256,
      }),
    ).toBe(true);
    const rendered = renderTodayMapCard();
    expect(rendered.manifest).toEqual(manifest);
    expect(Buffer.from(rendered.light.png).equals(readFileSync(resolve(`public${manifest.light}`)))).toBe(true);
    expect(Buffer.from(rendered.dark.png).equals(readFileSync(resolve(`public${manifest.dark}`)))).toBe(true);
  });

  it("marks REPD stale four months after the quarter and DUKES stale after fourteen months", () => {
    expect(repdQuarterEnd("REPD Q2 2026")).toBe("2026-06-30");
    expect(addCalendarMonths("2026-06-30", 4)).toBe("2026-10-30");
    expect(addCalendarMonths("2026-07-30", 14)).toBe("2027-09-30");
    const dates = { repdQuarterEnd: "2026-06-30", dukesPublishedOn: "2026-07-30" };
    expect(registerFreshness(dates, new Date("2026-10-20T12:00:00Z")).stale).toBe(false);
    expect(registerFreshness(dates, new Date("2026-10-30T23:00:00Z")).stale).toBe(false);
    expect(registerFreshness(dates, new Date("2026-10-31T00:00:00Z")).repdStale).toBe(true);
    expect(registerFreshness(dates, new Date("2027-09-30T00:00:00Z")).dukesStale).toBe(false);
    expect(registerFreshness(dates, new Date("2027-10-01T00:00:00Z")).dukesStale).toBe(true);
    expect(registerFreshness({ repdQuarterEnd: null, dukesPublishedOn: "2026-07-30" }, new Date("2026-10-20T00:00:00Z")).stale).toBe(
      true,
    );
  });

  it("draws an amber rule and an em dash when the edition is stale or the map is unavailable", () => {
    const fresh = renderToStaticMarkup(<TodayMapCardView file={manifest} now={new Date("2026-10-20T12:00:00Z")} />);
    expect(fresh).toContain(OGL_V3_ATTRIBUTION);
    expect(fresh).toContain(manifest.edition);
    expect(fresh).toContain("Open map →");
    expect(fresh).toContain("View as list");
    expect(fresh).toContain('loading="lazy"');
    expect(fresh).not.toContain("border-amber-700");
    expect(fresh).not.toContain(TODAY_MAP_PIPELINE_UNFILTERED);
    expect(fresh).toContain(TODAY_MAP_CONSENT);

    const stale = renderToStaticMarkup(<TodayMapCardView file={manifest} now={new Date("2026-11-01T00:00:00Z")} />);
    expect(stale).toContain("border-amber-700");

    const unavailable = renderToStaticMarkup(
      <TodayMapCardView
        file={{
          ...manifest,
          availability: "unavailable",
          operating: { gw: null, sites: null },
          technologies: [],
          nations: manifest.nations.map((row) => ({ ...row, gw: null, sites: 0 })),
          pipeline: { ...manifest.pipeline, gw: null, sites: null, stages: [] },
        }}
        now={new Date("2026-10-20T12:00:00Z")}
      />,
    );
    expect(unavailable).toContain("The map is not available for this edition.");
    expect(unavailable).toContain("—");
    expect(unavailable).not.toContain(">0<");
    expect(unavailable).not.toContain("0 GW");
    expect(unavailable).not.toContain("/today/map-light.png");
  });
});
