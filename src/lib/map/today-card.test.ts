import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadAssetCatalogue } from "@/lib/assets/load";
import {
  TODAY_MAP_LINK,
  TODAY_MAP_MAX_BYTES,
  TODAY_MAP_SUMMARY,
  TODAY_MAP_TITLE,
  containsBannedTodayMapPhrase,
  registerEditionLabel,
  todayMapAlt,
  todayMapEditionLine,
  todayMapPointRadius,
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
    expect(card).not.toContain("today-card-build");
    expect(card).not.toContain("static-map");
    expect(card).not.toContain("maplibre");
    expect(card).not.toContain("pmtiles");
    expect(card).not.toContain("blob.vercel-storage");
    expect(card).not.toContain('from "next/link"');
  });

  it("sets the alt count to the station total /map prints", () => {
    const catalogue = loadAssetCatalogue();
    const map = source("src/app/map/page.tsx");
    expect(map).toContain('All {catalogue.rows.length.toLocaleString("en-GB")} stations');
    expect(manifest.count).toBe(catalogue.rows.length);
    expect(manifest.alt).toBe(todayMapAlt(catalogue.rows.length));
    expect(manifest.alt).toBe(
      "Map of Great Britain showing 3,321 power stations, renewable and storage sites from published sources.",
    );
    expect(card).toContain("alt={card.alt}");
  });

  it("uses the draft copy, the register edition, and the OGL credit", () => {
    expect(card).toContain("TODAY_MAP_TITLE");
    expect(card).toContain("TODAY_MAP_SUMMARY");
    expect(card).toContain("TODAY_MAP_LINK");
    expect(card).toContain("todayMapEditionLine(card.edition)");
    expect(card).toContain("OGL_V3_ATTRIBUTION");
    expect(card).toContain("OGL_V3_LICENCE_URL");
    expect(card).toContain("NESO_OPEN_DATA_ATTRIBUTION");
    expect(card).not.toContain("Crown copyright");
    expect(TODAY_MAP_TITLE).toBe("Map of published infrastructure");
    expect(TODAY_MAP_SUMMARY).toBe(
      "Power stations, renewables and storage in Great Britain, from published sources.",
    );
    expect(TODAY_MAP_LINK).toBe("View on map");
    expect(todayMapEditionLine(manifest.edition)).toBe(`Register edition ${manifest.edition}`);
    expect(manifest.edition).toBe(registerEditionLabel("REPD Q2 2026", "May 2026"));
    expect(manifest.repd_source_release_id).toBe("desnz-repd:repd-quarterly:2026-08-03T09:00:03.000Z");
    expect(manifest.dukes_source_release_id).toBe("desnz-dukes:dukes-5.11:2026-07-30T00:00:00.000Z");
    for (const text of [
      card,
      JSON.stringify(manifest),
      TODAY_MAP_TITLE,
      TODAY_MAP_SUMMARY,
      TODAY_MAP_LINK,
      manifest.alt,
      todayMapEditionLine(manifest.edition),
    ]) {
      expect(containsBannedTodayMapPhrase(text)).toBe(false);
    }
  });

  it("links to /map with a focus ring below the answer and headline", () => {
    expect(card).toContain('href="/map"');
    expect(card).toContain("focus-visible:ring-2");
    expect(card).toContain("focus-visible:ring-blue-700");
    expect(dashboard.indexOf("<TodayMapCard />")).toBeGreaterThan(dashboard.indexOf("answer={answer}"));
    expect(dashboard.indexOf("<TodayMapCard />")).toBeGreaterThan(dashboard.indexOf('id="section-overview"'));
    expect(dashboard.indexOf("<TodayMapCard />")).toBeLessThan(dashboard.indexOf('id="section-price"'));
  });

  it("commits light and dark images under 150 KB for this release", () => {
    expect(manifest.light).toBe("/today/map-light.png");
    expect(manifest.dark).toBe("/today/map-dark.png");
    expect(manifest.width).toBeGreaterThan(0);
    expect(manifest.height).toBe(720);
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
      }),
    ).toBe(true);
    expect(
      todayMapReleaseCurrent(manifest, {
        ...manifest,
        dno_sha256: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      }),
    ).toBe(false);
    const rendered = renderTodayMapCard();
    expect(rendered.manifest).toEqual(manifest);
    expect(Buffer.from(rendered.light.png).equals(readFileSync(resolve(`public${manifest.light}`)))).toBe(true);
    expect(Buffer.from(rendered.dark.png).equals(readFileSync(resolve(`public${manifest.dark}`)))).toBe(true);
  });

  it("scales a station dot from its megawatts without dropping the base size", () => {
    expect(todayMapPointRadius(null)).toBe(todayMapPointRadius(0));
    expect(todayMapPointRadius(1200)).toBeGreaterThan(todayMapPointRadius(5));
    expect(todayMapPointRadius(5000)).toBeLessThanOrEqual(todayMapPointRadius(null) * 2.5);
  });
});
