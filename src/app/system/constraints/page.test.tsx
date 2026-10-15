import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConstraintsBoard } from "@/components/constraints/constraints-board";
import {
  CONSTRAINTS_BOUNDARY_TITLE,
  CONSTRAINTS_COST_SOURCE,
  CONSTRAINTS_COST_TITLE,
  CONSTRAINTS_H1,
  CONSTRAINTS_REVISIONS,
  CONSTRAINTS_STANDFIRST,
  CONSTRAINTS_TITLE,
  CONSTRAINTS_VOLUME_SOURCE,
  CONSTRAINTS_VOLUME_TITLE,
} from "@/lib/constraints/copy";
import { buildConstraintsPage } from "@/lib/constraints/page-model";
import { fixtureConstraintsHistory } from "@/lib/constraints/reader";

const BANNED = /\b(live|real-time|right now|flow now|UK)\b/i;

describe("constraints page", () => {
  it("is force-static, separates £ from MWh, and keeps the forecast off the measured chart", () => {
    const source = readFileSync(join(process.cwd(), "src/app/system/constraints/page.tsx"), "utf8");
    expect(source).toContain('export const dynamic = "force-static"');
    expect(source).toContain("export const revalidate = 3600");
    expect(source).toContain("CONSTRAINTS_TITLE");
    expect(source).toContain("CONSTRAINTS_H1");
    const copy = readFileSync(join(process.cwd(), "src/lib/constraints/copy.ts"), "utf8");
    expect(copy).toContain(CONSTRAINTS_TITLE);
    expect(copy).toContain(CONSTRAINTS_H1);
    expect(source).not.toContain("queryPipe");
    expect(source).not.toContain("maplibre");
    const cost = readFileSync(join(process.cwd(), "src/components/constraints/constraint-cost-chart.tsx"), "utf8");
    const volume = readFileSync(join(process.cwd(), "src/components/constraints/constraint-volume-chart.tsx"), "utf8");
    expect(cost.match(/<YAxis/g)).toHaveLength(1);
    expect(volume.match(/<YAxis/g)).toHaveLength(1);
    expect(cost).not.toContain("yAxisId");
    expect(volume).not.toContain("yAxisId");
    expect(cost).not.toContain("ComposedChart");
    expect(volume).not.toContain("ComposedChart");
    expect(cost).toContain('data-unit="GBP"');
    expect(volume).toContain('data-unit="MWh"');
    expect(cost).toContain("measuredCostChart");
    expect(volume).toContain("measuredVolumeChart");

    const model = buildConstraintsPage({
      breakdown: fixtureConstraintsHistory("breakdown").latest,
      breakdownPrevious: fixtureConstraintsHistory("breakdown").previous,
      dayAhead: fixtureConstraintsHistory("day-ahead").latest,
    });
    const html = renderToStaticMarkup(<ConstraintsBoard model={model} />);
    expect(html).toContain(CONSTRAINTS_COST_TITLE);
    expect(html).toContain(CONSTRAINTS_COST_SOURCE);
    expect(html).toContain(CONSTRAINTS_REVISIONS);
    expect(html).toContain(CONSTRAINTS_VOLUME_TITLE);
    expect(html).toContain(CONSTRAINTS_VOLUME_SOURCE);
    expect(html).toContain(CONSTRAINTS_BOUNDARY_TITLE);
    expect(html).toContain("Day-ahead forecast, issued ");
    expect(html).toContain('data-chart="constraint-cost"');
    expect(html).toContain('data-chart="constraint-volume"');
    expect(html).toContain("<table");
    expect(html).not.toMatch(BANNED);
    expect(html).not.toMatch(/curtailment/i);
    expect(CONSTRAINTS_STANDFIRST).toBe("Published transmission constraint activity, its volume and cost.");
  });
});
