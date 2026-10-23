import { describe, expect, it } from "vitest";
import { todayPipelineFromFigures } from "@/lib/map/today-pipeline";
import card from "@/lib/map/today-card.json";
import { loadPipelineCatalogue } from "@/lib/pipeline/load";
import { buildPipelineFigures, type PipelineFigures } from "@/lib/pipeline/model";
import type { PipelineRecord } from "@/lib/pipeline/records";

function record(patch: Partial<PipelineRecord> & Pick<PipelineRecord, "status" | "mw">): PipelineRecord {
  return {
    ref: "R1",
    name: "Example",
    technology: "solar_pv",
    country: "England",
    submitted: "2024-01-01",
    granted: null,
    appeal_granted: null,
    sos_granted: null,
    refused: null,
    withdrawn: null,
    appeal_lodged: null,
    appeal_refused: null,
    appeal_withdrawn: null,
    sos_refused: null,
    expired: null,
    construction: null,
    operational: null,
    ...patch,
  };
}

describe("today pipeline figures", () => {
  it("uses the pipeline aggregate and drops revised records", () => {
    const figures: PipelineFigures = buildPipelineFigures([
      record({ ref: "A", status: "under_construction", mw: 1000 }),
      record({ ref: "B", status: "revised", mw: 9000 }),
      record({ ref: "C", status: "awaiting_construction", mw: 500, country: "Scotland" }),
      record({ ref: "D", status: "application_submitted", mw: null, country: "Wales" }),
      record({ ref: "E", status: "under_construction", mw: 200, country: "Northern Ireland" }),
    ]);
    const cardFigures = todayPipelineFromFigures(figures);
    expect(cardFigures.sites).toBe(figures.projects);
    expect(cardFigures.gw).toBe(figures.totalGw);
    expect(cardFigures.filtered).toBe(true);
    expect(cardFigures.sites).toBe(3);
    expect(cardFigures.missing).toBe(1);
    expect(cardFigures.stages.find((row) => row.id === "under_construction")?.sites).toBe(1);
  });

  it("matches the committed home card to /pipeline", () => {
    const figures = loadPipelineCatalogue().figures;
    expect(card.pipeline).toEqual(todayPipelineFromFigures(figures));
    expect(card.pipeline.gw).toBe(figures.totalGw);
    expect(card.pipeline.sites).toBe(figures.projects);
  });
});
