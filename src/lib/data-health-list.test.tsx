import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataHealthSeriesList } from "@/components/data-health-series";
import { DataHealthReading } from "@/components/data-health-reading";
import { buildReading } from "@/lib/data-health";
import { groupHealthReadings, healthSeriesSummary, visibleDatasetId } from "@/lib/data-health-list";

const NOW = new Date("2026-10-14T11:00:00.000Z");

describe("data health series list", () => {
  it("hides a dataset UUID and keeps a publication code", () => {
    expect(visibleDatasetId("177f6fa4-ae49-4182-81ea-0c6b35f26ca6")).toBeNull();
    expect(visibleDatasetId("FUELINST")).toBe("FUELINST");
    const reading = buildReading({
      metricId: "elec.gb.generation.embedded_wind",
      value: 1200,
      publishedAt: NOW.toISOString(),
      retrievedAt: NOW.toISOString(),
      now: NOW,
    });
    const html = renderToStaticMarkup(<DataHealthReading reading={reading} />);
    expect(html).not.toContain("177f6fa4-ae49-4182-81ea-0c6b35f26ca6");
    expect(html).toContain("Current");
  });

  it("puts problems first and leaves current series collapsed", () => {
    const current = buildReading({
      metricId: "elec.gb.demand.itsdo",
      value: 28000,
      publishedAt: NOW.toISOString(),
      retrievedAt: NOW.toISOString(),
      now: NOW,
    });
    const missing = buildReading({
      metricId: "elec.gb.generation.wind",
      value: null,
      publishedAt: null,
      retrievedAt: null,
      now: NOW,
    });
    const groups = groupHealthReadings([current, missing]);
    expect(healthSeriesSummary(groups)).toBe("1 current, 0 not updated, 1 missing");
    const html = renderToStaticMarkup(<DataHealthSeriesList readings={[current, missing]} />);
    expect(html.indexOf("Wind")).toBeLessThan(html.indexOf("<details"));
    expect(html).toContain("Show 1 current series");
    expect(html).not.toContain("<details open");
  });
});
