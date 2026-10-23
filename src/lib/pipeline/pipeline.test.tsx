import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GET as pipelineCsvRoute } from "@/app/pipeline/projects.csv/route";
import PipelinePage from "@/app/pipeline/page";
import { PipelineChartBoundary } from "@/components/pipeline/chart-boundary";
import { PipelineBoard, StorageTooltip } from "@/components/pipeline/pipeline-board";
import { PipelineExplainer } from "@/components/pipeline/pipeline-explainer";
import { PipelineTable } from "@/components/pipeline/pipeline-table";
import { largestRemainder, roundDisplay } from "@/lib/display-rounding";
import { formatLondonDayMonthYear } from "@/lib/london-time";
import { buildOgCard } from "@/lib/og/model";
import {
  PIPELINE_CATALOGUE_UNAVAILABLE,
  PIPELINE_CHART_FAILED,
  PIPELINE_CLEAR_FILTERS,
  PIPELINE_CONSENTED_LABEL,
  PIPELINE_CREDIT,
  PIPELINE_EMPTY_FILTER,
  PIPELINE_DESCRIPTION,
  PIPELINE_EXCLUDED,
  PIPELINE_EXPLAINER,
  PIPELINE_EXPLAINER_LABEL,
  PIPELINE_H1,
  PIPELINE_METHODOLOGY,
  PIPELINE_MEDIAN_NOTE,
  PIPELINE_NOT_PUBLISHED,
  PIPELINE_NOT_UPDATED,
  PIPELINE_STORAGE_HEADING,
  PIPELINE_STORAGE_TOTAL,
  PIPELINE_TITLE,
} from "@/lib/pipeline/copy";
import { PIPELINE_FETCH_ATTEMPTS, PIPELINE_FETCH_TIMEOUT_MS, pipelineRetryDelayMs, pipelineStatusRetries } from "@/lib/pipeline/fetch";
import { pipelineEditionStale, pipelineNotUpdatedFrom, pipelinePublicationDay } from "@/lib/pipeline/freshness";
import { catalogueAfterFailedRead, loadKeepingLast, loadPipelineCatalogue } from "@/lib/pipeline/load";
import { pipelineStageSubline } from "@/lib/pipeline/share";
import {
  buildPipelineFigures,
  formatMedianDuration,
  medianDays,
  storageRowText,
  sumDisplayedGw,
  type PipelineTableRow,
} from "@/lib/pipeline/model";
import { normaliseRepdStatus, parseRepdPipeline } from "@/lib/pipeline/parse";
import type { PipelineRecord } from "@/lib/pipeline/records";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function roundedGwSubtotal(rows: readonly { exactGw: number }[]): number {
  const eligible = rows.map((row) => (row.exactGw >= 0.1 ? row.exactGw : 0));
  return roundDisplay(
    largestRemainder(eligible, 0.1).reduce((sum, value) => sum + value, 0),
    0.1,
  );
}

function shownTechnologyMw(rows: readonly { amount: string }[]): number {
  return rows.reduce((sum, row) => {
    if (row.amount.endsWith(" GW")) {
      return sum + Number(row.amount.replace(" GW", "")) * 1000;
    }
    if (row.amount.endsWith(" MW")) {
      return sum + Number(row.amount.replaceAll(",", "").replace(" MW", ""));
    }
    return sum;
  }, 0);
}

function record(patch: Partial<PipelineRecord> & Pick<PipelineRecord, "ref" | "status">): PipelineRecord {
  return {
    name: patch.ref,
    technology: "solar_pv",
    country: "England",
    mw: 100,
    submitted: "2020-01-01",
    granted: null,
    appeal_granted: null,
    sos_granted: null,
    refused: null,
    withdrawn: null,
    appeal_lodged: null,
    appeal_withdrawn: null,
    appeal_refused: null,
    sos_refused: null,
    expired: null,
    construction: null,
    operational: null,
    ...patch,
  };
}

describe("pipeline figures", () => {
  const catalogue = loadPipelineCatalogue();
  const figures = catalogue.figures;

  it("matches the July 2026 GB pipeline", () => {
    expect(catalogue.edition.edition).toBe("REPD Q2 2026");
    expect(catalogue.edition.edition_day).toBe("2026-08-03");
    expect(catalogue.stamp).toBe("July 2026 (Q2). Published 3 Aug 2026.");
    expect(figures.projects).toBe(7668);
    expect(figures.totalGw).toBe("267.4");
    expect(figures.missingCapacity).toBe(991);
    expect(figures.stages.map((stage) => [stage.id, stage.gw, stage.projects])).toEqual([
      ["under_construction", "27.9", 452],
      ["consented", "145.3", 5779],
      ["in_planning", "94.2", 1437],
    ]);
    expect(figures.nations.map((nation) => [nation.id, nation.gw])).toEqual([
      ["England", "157.0"],
      ["Scotland", "99.3"],
      ["Wales", "11.1"],
    ]);
    expect(figures.storage.map((part) => [part.id, part.label, part.gw])).toEqual([
      ["battery", "Battery storage", "122.1"],
      ["other_storage", "Other storage", "10.9"],
      ["generation", "Generation", "134.4"],
    ]);
    expect(figures.storageTotal.gw).toBe("133.0");
    expect(figures.storageTotal.exactMwLabel).toBe("133,083.5 MW");
    expect(figures.storageTotal.rows.map((row) => row.text)).toEqual([
      "Battery storage: 122.1 GW",
      "Pumped storage: 10.9 GW",
      "Liquid Air Energy Storage: 49.9 MW",
      "Compressed Air Energy Storage: 5.0 MW",
    ]);
    expect(storageRowText("Liquid Air Energy Storage", 49.9)).toBe("Liquid Air Energy Storage: 49.9 MW");
    expect(storageRowText("Compressed Air Energy Storage", 5)).toBe("Compressed Air Energy Storage: 5.0 MW");
    expect(storageRowText("Tiny", 50)).toBe("Tiny: 50.0 MW");
    for (const row of figures.storageTotal.rows) {
      expect(row.text).not.toContain("0.0 GW");
      expect(row.text).not.toContain("<0.1 GW");
    }
    expect(figures.stages.map((stage) => stage.label)).toEqual([
      "Under construction",
      PIPELINE_CONSENTED_LABEL,
      "In planning",
    ]);
    expect(figures.medians.map((step) => step.label)).toContain(PIPELINE_CONSENTED_LABEL);
    expect(figures.cohort.outcomes.map((outcome) => outcome.label)).toContain(PIPELINE_CONSENTED_LABEL);
    expect(figures.northernIreland).toMatchObject({ projects: 282, gw: "3.2" });
    expect(figures.cohort).toMatchObject({ applications: 1814, consented: 1368, built: 779, operating: 616 });
  });

  it("excludes revised and no application required from the 2015–2020 group", () => {
    const window = catalogue.records.filter((row) => {
      if (row.country !== "England" && row.country !== "Scotland" && row.country !== "Wales") {
        return false;
      }
      const year = row.submitted === null ? null : Number(row.submitted.slice(0, 4));
      return year !== null && year >= 2015 && year <= 2020;
    });
    const revised = window.filter((row) => row.status === "revised").length;
    const noApplicationRequired = window.filter((row) => row.status === "no_application_required").length;
    expect(window.length).toBe(1962);
    expect(revised).toBe(148);
    expect(noApplicationRequired).toBe(0);
    expect(window.length - revised - noApplicationRequired).toBe(1814);
    expect(figures.cohort.applications).toBe(1814);
    const heldOut = buildPipelineFigures([
      record({ ref: "revised", status: "revised", submitted: "2017-06-01" }),
      record({ ref: "none", status: "no_application_required", submitted: "2018-06-01" }),
      record({ ref: "kept", status: "operational", submitted: "2016-06-01" }),
    ]);
    expect(heldOut.cohort.applications).toBe(1);
  });

  it("makes every displayed split add up to the shown total", () => {
    expect(sumDisplayedGw(figures.stages)).toBe(267.4);
    expect(sumDisplayedGw(figures.nations)).toBe(267.4);
    expect(sumDisplayedGw(figures.storage)).toBe(267.4);
    expect(sumDisplayedGw(figures.technologies)).toBe(roundedGwSubtotal(figures.technologies));
    expect(sumDisplayedGw(figures.technologies)).toBeLessThan(Number(figures.totalGw));
    for (const row of figures.technologies) {
      expect(row.amount).not.toBe("—");
      expect(row.amount).not.toContain("0.0 GW");
      expect(row.amount).not.toContain("<0.1");
      if (row.exactGw > 0 && row.exactGw < 0.1) {
        expect(row.amount.endsWith(" MW")).toBe(true);
        expect(row.gw).toBe("0.0");
      }
      if (row.exactGw >= 0.1) {
        expect(row.amount).toBe(`${row.gw} GW`);
      }
    }
    expect(shownTechnologyMw(figures.technologies)).toBeLessThan(Number(figures.totalGw) * 1000 + 50);
    expect(figures.technologies.find((row) => row.technology === "battery")?.amount).toBe("122.1 GW");
    expect(figures.technologies.find((row) => row.technology === "liquid_air")?.amount).toBe("49.9 MW");
    expect(figures.technologies.find((row) => row.technology === "compressed_air")?.amount).toBe("5.0 MW");
    expect(figures.technologies.find((row) => row.technology === "heat_pump")?.amount).toBe("2.0 MW");
    expect(figures.technologies.find((row) => row.technology === "unspecified")?.amount).toBe(PIPELINE_NOT_PUBLISHED);
    expect(Number(figures.totalGw)).toBe(267.4);
    const mixed = buildPipelineFigures([
      record({ ref: "bat", status: "under_construction", technology: "battery", mw: 1040 }),
      record({ ref: "sun", status: "under_construction", technology: "solar_pv", mw: 1040 }),
      record({ ref: "air", status: "under_construction", technology: "liquid_air", mw: 49.9 }),
      record({ ref: "heat", status: "under_construction", technology: "heat_pump", mw: 2 }),
      record({ ref: "none", status: "awaiting_construction", technology: "unspecified", mw: null }),
    ]);
    expect(sumDisplayedGw(mixed.technologies)).toBe(roundedGwSubtotal(mixed.technologies));
    expect(sumDisplayedGw(mixed.technologies)).toBe(2.1);
    expect(mixed.technologies.find((row) => row.technology === "battery")?.amount).toBe("1.1 GW");
    expect(mixed.technologies.find((row) => row.technology === "solar_pv")?.amount).toBe("1.0 GW");
    expect(mixed.technologies.find((row) => row.technology === "liquid_air")?.amount).toBe("49.9 MW");
    expect(mixed.technologies.find((row) => row.technology === "heat_pump")?.amount).toBe("2.0 MW");
    expect(mixed.technologies.find((row) => row.technology === "unspecified")?.amount).toBe(PIPELINE_NOT_PUBLISHED);
    expect(shownTechnologyMw(mixed.technologies)).toBe(2151.9);
    const shown = largestRemainder([1.04, 1.04, 1.04], 0.1);
    expect(shown).toEqual([1.1, 1.0, 1.0]);
    expect(Number(shown.reduce((sum, value) => sum + value, 0).toFixed(1))).toBe(3.1);
    expect(figures.cohort.outcomes.reduce((sum, outcome) => sum + outcome.percent, 0)).toBe(100);
  });

  it("counts a project with no rated capacity and never stores it as zero", () => {
    const figures = buildPipelineFigures([
      record({ ref: "a", status: "under_construction", mw: null, country: "Scotland" }),
      record({ ref: "b", status: "revised", mw: 0, country: "England" }),
      record({ ref: "c", status: "awaiting_construction", mw: 50.5, country: "Northern Ireland" }),
    ]);
    expect(figures.projects).toBe(1);
    expect(figures.missingCapacity).toBe(1);
    expect(figures.table[0]?.capacityLabel).toBe(PIPELINE_NOT_PUBLISHED);
    expect(figures.table[0]?.capacityLabel).not.toBe("0 MW");
    expect(figures.totalGw).toBe("0.0");
    expect(figures.northernIreland).toMatchObject({ projects: 1, gw: "0.1" });
    expect(figures.revised).toBe(1);
  });

  it("links a pipeline row only when the asset register has that REPD ref", () => {
    const row = buildPipelineFigures([record({ ref: "42", status: "application_submitted" })], (ref) =>
      ref === "42" ? "/assets/ast_x/example" : null,
    ).table[0] as PipelineTableRow;
    expect(row.href).toBe("/assets/ast_x/example");
    expect(figures.table.every((item) => item.href === null || item.href.startsWith("/assets/"))).toBe(true);
  });

  it("normalises status text and drops revised records from the pipeline", () => {
    expect(normaliseRepdStatus("  Under   Construction ")).toBe("under_construction");
    expect(normaliseRepdStatus("REVISED")).toBe("revised");
    const text = [
      "Ref ID,Site Name,Technology Type,Installed Capacity (MWelec),Development Status (short),Country,Planning Application Submitted,Planning Application Withdrawn,Planning Permission Refused,Appeal Lodged,Appeal Withdrawn,Appeal Refused,Appeal Granted,Planning Permission  Granted,Secretary of State - Refusal,Secretary of State - Granted,Planning Permission Expired,Under Construction,Operational",
      "1,Alpha,Solar Photovoltaics,10, revised ,England,01/01/2018,,,,,,,,,,,,,",
      "2,Beta,Battery,,Application Submitted,Wales,02/02/2019,,,,,,,,,,,,,",
    ].join("\n");
    const parsed = parseRepdPipeline(text);
    expect(parsed[1]?.status).toBe("application_submitted");
    expect(parsed[1]?.mw).toBeNull();
    expect(buildPipelineFigures(parsed).projects).toBe(1);
  });

  it("reports medians only for projects that finished the step", () => {
    expect(medianDays([])).toBeNull();
    expect(medianDays([10, 30, 20])).toBe(20);
    expect(medianDays([10, 40])).toBe(40);
    expect(formatMedianDuration(120)).toBe("120 days");
    expect(formatMedianDuration(399)).toBe("1 year, 34 days");
    expect(figures.medians.map((step) => step.days)).toEqual([120, 399, 152]);
    expect(figures.medians.every((step) => step.projects > 0)).toBe(true);
  });

  it("marks the edition not updated 120 days after the publication date", () => {
    const publication = pipelinePublicationDay(catalogue.edition);
    expect(catalogue.edition.published_at.startsWith("2026-08-03")).toBe(true);
    expect(publication).toBe("2026-08-03");
    expect(publication).toBe(catalogue.edition.edition_day);
    expect(PIPELINE_NOT_UPDATED).toBe("Not updated");
    expect(formatLondonDayMonthYear(publication)).toBe("3 Aug 2026");
    const shownFrom = pipelineNotUpdatedFrom(publication);
    expect(shownFrom).toBe("2026-12-01");
    expect(formatLondonDayMonthYear(shownFrom ?? "")).toBe("1 Dec 2026");
    expect(pipelineEditionStale(publication, new Date("2026-10-20T12:00:00Z"))).toBe(false);
    expect(pipelineEditionStale(publication, new Date("2026-11-21T00:00:00Z"))).toBe(false);
    expect(pipelineEditionStale(publication, new Date("2026-11-30T12:00:00Z"))).toBe(false);
    expect(pipelineEditionStale(publication, new Date("2026-12-01T00:00:00Z"))).toBe(true);
    expect(pipelineEditionStale("2026-07-24", new Date("2026-11-21T00:00:00Z"))).toBe(true);
    expect(source("src/lib/pipeline/parse.ts")).not.toContain("Record Last Updated");
    expect(source("src/app/pipeline/page.tsx")).toContain("pipelinePublicationDay");
  });

  it("bounds the extract download", () => {
    expect(PIPELINE_FETCH_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
    expect(PIPELINE_FETCH_ATTEMPTS).toBe(3);
    expect(pipelineRetryDelayMs(1)).toBe(2_000);
    expect(pipelineRetryDelayMs(2)).toBe(8_000);
    expect(pipelineRetryDelayMs(3)).toBeNull();
    expect(pipelineStatusRetries(429)).toBe(true);
    expect(pipelineStatusRetries(500)).toBe(true);
    expect(pipelineStatusRetries(404)).toBe(false);
  });
});

describe("pipeline page", () => {
  it("is static, has the copy, and does not call Tinybird or MapLibre", () => {
    const page = source("src/app/pipeline/page.tsx");
    const home = source("src/app/page.tsx");
    const card = source("src/components/today-map-card.tsx");
    expect(page).toContain('export const dynamic = "force-static"');
    expect(home).toContain('export const dynamic = "force-static"');
    expect(home).toContain("export const revalidate = 300");
    expect(page).not.toContain("queryPipe");
    expect(page).not.toContain("maplibre");
    expect(card).not.toContain("maplibre");
    expect(card).not.toContain("loadPipelineCatalogue");
    expect(PIPELINE_TITLE).toBe("GB renewable and storage project pipeline | Grid");
    expect(PIPELINE_DESCRIPTION).toBe(
      "Renewable and storage projects in Great Britain, from planning to construction, by stage and technology. From DESNZ's REPD, updated quarterly.",
    );
    expect(PIPELINE_H1).toBe("What's in GB's pipeline of new energy projects?");
    const html = renderToStaticMarkup(PipelinePage());
    expect(html).toContain("pipeline of new energy projects");
    expect(html).toContain("July 2026 (Q2). Published 3 Aug 2026.");
    expect(html).toContain("7,668");
    expect(html).toContain("267.4");
    expect(html).toContain(PIPELINE_EXCLUDED);
    expect(html).toContain("27.9");
    expect(html).toContain("145.3");
    expect(html).toContain("94.2");
    expect(html).toContain("157.0");
    expect(html).toContain("99.3");
    expect(html).toContain("11.1");
    expect(html).toContain("122.1");
    expect(html).toContain("10.9");
    expect(html).toContain("134.4");
    expect(html).toContain("Battery storage");
    expect(html).toContain("Other storage");
    expect(html).toContain("Generation");
    expect(html).toContain("133.0 GW");
    expect(html).toContain('aria-label="What is the storage total?"');
    expect(html).toContain(PIPELINE_CONSENTED_LABEL);
    expect(html).not.toContain("Consented, awaiting construction");
    expect(html).not.toContain("Consented, not built");
    expect(html.toLowerCase()).not.toContain("flywheel");
    expect(PIPELINE_METHODOLOGY.join(" ").toLowerCase()).not.toContain("flywheel");
    const shown = loadPipelineCatalogue().figures;
    expect(shown.technologies.every((row) => !row.label.toLowerCase().includes("flywheel"))).toBe(true);
    expect(shown.table.every((row) => !row.technologyLabel.toLowerCase().includes("flywheel") && !row.name.toLowerCase().includes("flywheel"))).toBe(true);
    expect(html).toContain("1,814");
    expect(html).toContain("1,368");
    expect(html).toContain("779");
    expect(html).toContain("616");
    expect(html).toContain(PIPELINE_MEDIAN_NOTE);
    expect(html).toContain("120 days");
    expect(html).toContain("282");
    expect(html).toContain('href="/electricity/northern-ireland"');
    expect(html).toContain(PIPELINE_CREDIT);
    expect(html).toContain("Download CSV");
    expect(html).not.toContain(PIPELINE_NOT_UPDATED);
    expect(html).not.toContain("0.0 GW");
    expect(html).not.toContain("&lt;0.1 GW");
    expect(html).not.toContain("<0.1 GW");
    expect(html).toContain("49.9 MW");
    expect(html).toContain("5.0 MW");
    expect(html).toContain("2.0 MW");
    expect(html).toContain(
      "A technology under 0.1 GW is shown in MW to one decimal and is left out of the gigawatt split.",
    );
    expect(page).not.toContain("searchParams");
    const table = source("src/components/pipeline/pipeline-table.tsx");
    expect(table).toContain("<TableScroll");
    expect(source("src/components/ui/table-scroll.tsx")).toContain("Swipe for more columns");
    expect(table).toContain('className="relative py-2 pr-3 font-normal"');
    for (const section of PIPELINE_EXPLAINER) {
      expect(html).toContain(section.title);
    }
    expect(source("src/app/data-sources/page.tsx")).not.toContain("queryPipe");
    expect(source("data/catalogue/sources.json")).toContain(PIPELINE_CREDIT);
  });

  it("shows the not updated state when the edition is old", () => {
    const catalogue = loadPipelineCatalogue();
    const html = renderToStaticMarkup(
      <PipelineBoard figures={catalogue.figures} stamp={catalogue.stamp} stale />,
    );
    expect(html).toContain(PIPELINE_NOT_UPDATED);
    expect(html).toContain('role="status"');
    expect(html).toContain("border-amber-700");
    expect(html).toContain("7,668");
    expect(html).toContain("267.4");
    const tooltip = renderToStaticMarkup(<StorageTooltip total={catalogue.figures.storageTotal} />);
    expect(tooltip).toContain(PIPELINE_STORAGE_HEADING);
    expect(tooltip).toContain(PIPELINE_STORAGE_TOTAL);
    expect(tooltip).toContain(catalogue.figures.storageTotal.exactMwLabel);
    for (const row of catalogue.figures.storageTotal.rows) {
      expect(tooltip).toContain(row.text);
    }
    expect(tooltip).not.toContain("0.0 GW");
    expect(tooltip).not.toContain("<0.1 GW");
  });

  it("keeps the last built figures when the catalogue cannot be read", () => {
    const catalogue = loadPipelineCatalogue();
    const kept = loadKeepingLast(
      process.cwd(),
      () => {
        throw new Error("catalogue missing");
      },
      catalogue,
    );
    expect(catalogueAfterFailedRead(null)).toBeNull();
    expect(kept.unavailable).toBe(true);
    expect(kept.figures).toBe(catalogue.figures);
    const html = renderToStaticMarkup(
      <PipelineBoard figures={kept.figures} stamp={kept.stamp} stale={false} unavailable />,
    );
    expect(html).toContain(PIPELINE_CATALOGUE_UNAVAILABLE);
    expect(html).toContain("7,668");
    expect(html).toContain("267.4");
  });

  it("shows table and chart skeletons while loading", () => {
    const catalogue = loadPipelineCatalogue();
    const html = renderToStaticMarkup(
      <PipelineBoard figures={catalogue.figures} stamp={catalogue.stamp} stale={false} preview="loading" />,
    );
    expect(html).toContain('data-pipeline-state="loading"');
    expect(html).toContain('data-slot="skeleton"');
    expect(html).toContain('data-slot="card-loading"');
    expect(html).toContain("7,668");
    expect(html).not.toContain("<table");
  });

  it("says when no projects match the filters", () => {
    const catalogue = loadPipelineCatalogue();
    const html = renderToStaticMarkup(<PipelineTable rows={catalogue.figures.table} forcedEmpty />);
    expect(html).toContain(PIPELINE_EMPTY_FILTER);
    expect(html).toContain(PIPELINE_CLEAR_FILTERS);
    expect(html).not.toContain("<table");
  });

  it("keeps the table when a chart fails to render", () => {
    const catalogue = loadPipelineCatalogue();
    const html = renderToStaticMarkup(
      <PipelineBoard figures={catalogue.figures} stamp={catalogue.stamp} stale={false} preview="chart" />,
    );
    expect(html).toContain(PIPELINE_CHART_FAILED);
    expect(html).toContain("<table");
    expect(html).toContain("Download CSV");
    expect(PipelineChartBoundary.getDerivedStateFromError()).toEqual({ failed: true });
    const failed = renderToStaticMarkup(
      <PipelineChartBoundary fail>
        <p>chart</p>
      </PipelineChartBoundary>,
    );
    expect(failed).toContain(PIPELINE_CHART_FAILED);
    expect(failed).not.toContain("<p>chart</p>");
  });

  it("serves the project table as CSV", async () => {
    const response = pipelineCsvRoute();
    expect(response.headers.get("content-type")).toContain("text/csv");
    const body = await response.text();
    const lines = body.trim().split("\n");
    expect(lines[0]).toBe("name,stage,technology,nation,capacity_mw,status_date,repd_ref,asset_path");
    expect(lines.length).toBe(7669);
    expect(body).not.toContain(",0,");
    expect(body).toContain(`"${PIPELINE_CONSENTED_LABEL}"`);
    expect(body.toLowerCase()).not.toContain("flywheel");
  });

  it("collapses the explainer behind the mobile label", () => {
    const html = renderToStaticMarkup(<PipelineExplainer />);
    expect(PIPELINE_EXPLAINER_LABEL).toBe("How the pipeline works");
    expect(html).toContain(PIPELINE_EXPLAINER_LABEL);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("md:hidden");
    expect(html).toContain("hidden");
    expect(html).toContain("md:flex");
  });

  it("shows a dash when a nation or storage bucket has projects and no published capacity", () => {
    const figures = buildPipelineFigures([
      record({ ref: "built", status: "under_construction", mw: 1000, country: "England" }),
      record({ ref: "blank", status: "awaiting_construction", mw: null, country: "Wales", technology: "battery" }),
    ]);
    expect(figures.nations.find((row) => row.id === "Wales")?.gw).toBe("0.0");
    expect(figures.storage.find((row) => row.id === "battery")?.gw).toBe("0.0");
    const html = renderToStaticMarkup(<PipelineBoard figures={figures} stamp="July 2026 (Q2)." stale={false} />);
    const split = html.slice(html.indexOf('aria-label="Storage split"'), html.indexOf("By technology"));
    const nations = html.slice(html.indexOf('aria-label="Capacity by nation"'), html.indexOf("What happened"));
    expect(split).toContain("Battery storage");
    expect(split).toContain('aria-label="Under 0.1 GW"');
    expect(split).not.toContain("0.0 GW");
    expect(nations).toContain("Wales");
    expect(nations).toContain('aria-label="Under 0.1 GW"');
    expect(nations).not.toContain("0.0 GW");
  });

  it("puts the GW total and the stage split on the share image", () => {
    const shown = loadPipelineCatalogue().figures;
    const consented = shown.stages.find((stage) => stage.id === "consented");
    const card = buildOgCard({ kind: "page", page: "pipeline" }, { facts: null, records: null, prices: null });
    expect(consented).toBeDefined();
    expect(pipelineStageSubline(consented!)).toBe(`${consented!.gw} GW consented, not yet built`);
    expect(card.kicker).toBe(shown.stages.map((stage) => pipelineStageSubline(stage)).join(" · "));
    expect(card.title).toBe(`${shown.totalGw} GW · ${shown.projects.toLocaleString("en-GB")} projects`);
    expect(source("src/lib/pipeline/share.ts")).not.toMatch(/\d+\.\d+/);
    expect(card.source).toContain(PIPELINE_CREDIT);
    expect(card.stamp).toBe("July 2026 (Q2). Published 3 Aug 2026.");
  });
});
