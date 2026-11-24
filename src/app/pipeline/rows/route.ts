import { NextResponse } from "next/server";
import { API_ERROR_UNSUPPORTED_FILTER } from "@/lib/api/errors";
import { boundedQuery, catalogueCacheHeaders, pageNumber, rejectUnknownParams } from "@/lib/catalogue-pages/params";
import { pipelineCsv } from "@/lib/pipeline/csv";
import { isPipelineSort, matchingPipelineRows, selectPipelineRows } from "@/lib/pipeline/list";
import { loadPipelineCatalogue } from "@/lib/pipeline/load";

/**
 * One page of the renewable planning table, or a CSV of the filtered rows.
 * The HTML page does not inline the register. No Tinybird query.
 */
export const dynamic = "force-dynamic";

const ALLOWED = ["stage", "technology", "nation", "sort", "dir", "page", "format"] as const;
const STAGES = new Set(["all", "under_construction", "consented", "in_planning"]);

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const extra = rejectUnknownParams(params, ALLOWED);
  if (extra) {
    return NextResponse.json(extra, { status: 400 });
  }
  const stage = params.get("stage") ?? "all";
  const technology = boundedQuery(params.get("technology"));
  const nation = boundedQuery(params.get("nation"));
  const sort = params.get("sort") ?? "capacity";
  const direction = params.get("dir") ?? "desc";
  const page = pageNumber(params.get("page"));
  const format = params.get("format");
  if (
    !STAGES.has(stage) ||
    technology === null ||
    nation === null ||
    !isPipelineSort(sort) ||
    (direction !== "asc" && direction !== "desc") ||
    page === null ||
    (format !== null && format !== "csv")
  ) {
    return NextResponse.json({ error: API_ERROR_UNSUPPORTED_FILTER }, { status: 400 });
  }
  const rows = loadPipelineCatalogue().figures.table;
  const query = {
    stage,
    technology: technology || "all",
    nation: nation || "all",
    sort,
    direction: direction === "asc" ? "asc" as const : "desc" as const,
    page,
  };
  if (format === "csv") {
    const csv = pipelineCsv(matchingPipelineRows(rows, query));
    return new Response(csv, {
      headers: {
        ...catalogueCacheHeaders(),
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"gb-renewable-storage-pipeline.csv\"",
      },
    });
  }
  const list = selectPipelineRows(rows, query);
  return NextResponse.json(
    { total: list.total, page: list.page, pages: list.pages, projects: list.rows },
    { headers: catalogueCacheHeaders() },
  );
}
