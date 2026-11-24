import { NextResponse } from "next/server";
import { API_ERROR_UNSUPPORTED_FILTER } from "@/lib/api/errors";
import { boundedQuery, catalogueCacheHeaders, pageNumber, rejectUnknownParams } from "@/lib/catalogue-pages/params";
import { loadProjectCatalogue } from "@/lib/projects/load";
import { queryProjectRows } from "@/lib/projects/list";
import { projectIndexRow } from "@/lib/projects/page-model";

/**
 * One page of the project register for the directory table.
 * The HTML page does not inline the register. No Tinybird query.
 */
export const dynamic = "force-dynamic";

const ALLOWED = ["q", "stage", "technology", "nation", "page"] as const;

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const extra = rejectUnknownParams(params, ALLOWED);
  if (extra) {
    return NextResponse.json(extra, { status: 400 });
  }
  const q = boundedQuery(params.get("q"));
  const page = pageNumber(params.get("page"));
  const stage = params.get("stage") ?? "all";
  const technology = params.get("technology") ?? "all";
  const nation = params.get("nation") ?? "all";
  if (q === null || page === null || stage.length > 80 || technology.length > 80 || nation.length > 80) {
    return NextResponse.json({ error: API_ERROR_UNSUPPORTED_FILTER }, { status: 400 });
  }
  const rows = loadProjectCatalogue().projects.map(projectIndexRow);
  const list = queryProjectRows(rows, { q, stage, technology, nation, page });
  return NextResponse.json(
    { total: list.total, page: list.page, pages: list.pages, projects: list.rows },
    { headers: catalogueCacheHeaders() },
  );
}
