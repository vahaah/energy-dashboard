import { NextResponse } from "next/server";
import { API_ERROR_UNSUPPORTED_FILTER } from "@/lib/api/errors";
import { queryAssetPage, toAssetListRow } from "@/lib/assets/list";
import { loadAssetCatalogue } from "@/lib/assets/load";
import { ASSET_PAGE_SIZE, ASSET_SORTS, isAssetSource, isAssetTechnology, type AssetSort } from "@/lib/assets/types";
import { boundedQuery, catalogueCacheHeaders, pageNumber, rejectUnknownParams } from "@/lib/catalogue-pages/params";

/**
 * One page of the asset directory. The HTML page does not inline the register.
 * No Tinybird query.
 */
export const dynamic = "force-dynamic";

const ALLOWED = ["q", "preset", "technology", "status", "source", "region", "sort", "dir", "page"] as const;

function isSort(value: string): value is AssetSort {
  return (ASSET_SORTS as readonly string[]).includes(value);
}

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const extra = rejectUnknownParams(params, ALLOWED);
  if (extra) {
    return NextResponse.json(extra, { status: 400 });
  }
  const q = boundedQuery(params.get("q"));
  const page = pageNumber(params.get("page"));
  const presetRaw = params.get("preset");
  const technologyRaw = params.get("technology");
  const statusRaw = params.get("status");
  const sourceRaw = params.get("source");
  const region = params.get("region") ?? "";
  const sortRaw = params.get("sort") ?? "name";
  const dirRaw = params.get("dir") ?? "asc";
  if (
    q === null ||
    page === null ||
    (presetRaw !== null && presetRaw !== "flows") ||
    (technologyRaw !== null && !isAssetTechnology(technologyRaw)) ||
    (statusRaw !== null && statusRaw !== "operational") ||
    (sourceRaw !== null && !isAssetSource(sourceRaw)) ||
    region.length > 80 ||
    !isSort(sortRaw) ||
    (dirRaw !== "asc" && dirRaw !== "desc")
  ) {
    return NextResponse.json({ error: API_ERROR_UNSUPPORTED_FILTER }, { status: 400 });
  }
  const catalogue = loadAssetCatalogue();
  const list = queryAssetPage(
    catalogue.rows,
    {
      q,
      technology: technologyRaw,
      status: statusRaw,
      source: sourceRaw,
      region,
      sort: sortRaw,
      dir: dirRaw,
      page,
      pageSize: ASSET_PAGE_SIZE,
    },
    presetRaw,
  );
  return NextResponse.json(
    {
      total: list.total,
      page: list.page,
      pages: list.pages,
      assets: list.rows.map(toAssetListRow),
    },
    { headers: catalogueCacheHeaders() },
  );
}
