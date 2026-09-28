import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Stat } from "./stat";

describe("Stat", () => {
  it("renders data-stat, data-unit, a dated time, and data-source", () => {
    const html = renderToStaticMarkup(
      <Stat
        stat="carbon_intensity"
        label="Carbon intensity"
        value="48"
        unit="gCO₂/kWh"
        datetime="2026-09-27T16:00:00.000Z"
        timeLabel="27 Sep 2026, 17:00 BST"
        source="Carbon Intensity API"
        sourceHref="#sources-carbon"
      />
    );

    expect(html).toContain('data-stat="carbon_intensity"');
    expect(html).toContain('data-unit="gCO₂/kWh"');
    expect(html).toMatch(/<time datetime="2026-09-27T16:00:00.000Z">/i);
    expect(html).toContain("27 Sep 2026, 17:00 BST");
    expect(html).toContain('data-source="Carbon Intensity API"');
    expect(html).toContain("Carbon Intensity API");
    expect(html).toContain("gCO₂/kWh");
    expect(html).toContain("font-mono");
    expect(html).toContain("tabular-nums");
  });

  it("uses Geist Sans tabular-nums at text-4xl for headline stats", () => {
    const html = renderToStaticMarkup(
      <Stat
        stat="generating"
        label="Generating"
        value="20.2"
        unit="GW"
        datetime="2026-09-28T07:00:00.000Z"
        timeLabel="08:00–08:30 BST"
        source="Elexon BMRS"
        size="headline"
      />
    );

    expect(html).toContain("font-sans");
    expect(html).toContain("text-4xl");
    expect(html).toContain("tabular-nums");
    expect(html).toContain("Generating");
  });

  it("renders a plain source when no href is provided", () => {
    const html = renderToStaticMarkup(
      <Stat
        stat="demand"
        value="29.4"
        unit="GW"
        datetime="2026-09-27T15:30:00.000Z"
        timeLabel="16:00–16:30 BST"
        source="Elexon BMRS"
      />
    );

    expect(html).toContain('data-source="Elexon BMRS"');
    expect(html).not.toContain("<a ");
  });
});
