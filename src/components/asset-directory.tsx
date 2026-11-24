"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useQueryStates } from "nuqs";
import { assetHref } from "@/lib/assets/href";
import { type AssetListRow, isDefaultAssetQuery } from "@/lib/assets/list";
import { LOCATION_UNAVAILABLE, formatMw, technologyLabel } from "@/lib/assets/labels";
import { assetListParsers } from "@/lib/assets/params";
import type { AssetListQuery } from "@/lib/assets/query";
import {
  ASSET_SORTS,
  ASSET_SOURCES,
  isAssetSource,
  isAssetTechnology,
  type AssetSort,
} from "@/lib/assets/types";
import { fetchBoundedJson } from "@/lib/http/bounded-json";
import { Card } from "@/components/ui/card";
import { TableScroll } from "@/components/ui/table-scroll";

const SORT_LABEL: Record<AssetSort, string> = {
  name: "Name",
  technology: "Technology",
  status: "Status",
  mw: "Capacity",
  region: "Region",
  source: "Source",
};

function sortLabel(sort: AssetSort): string {
  switch (sort) {
    case "name":
    case "technology":
    case "status":
    case "mw":
    case "region":
    case "source":
      return SORT_LABEL[sort];
    default: {
      const neverSort: never = sort;
      return neverSort;
    }
  }
}

type RemotePage = {
  assets: AssetListRow[];
  total: number;
  page: number;
  pages: number;
};

function isRemotePage(value: unknown): value is RemotePage {
  if (!value || typeof value !== "object") {
    return false;
  }
  const body = value as RemotePage;
  return Array.isArray(body.assets) && typeof body.total === "number" && typeof body.pages === "number";
}

export function AssetDirectory({
  rows,
  total,
  pages,
  regions,
  technologies,
}: {
  rows: readonly AssetListRow[];
  total: number;
  pages: number;
  regions: readonly string[];
  technologies: readonly AssetListRow["technology"][];
}) {
  const [url, setUrl] = useQueryStates(assetListParsers, { history: "replace", shallow: true, scroll: false });
  const client = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [remote, setRemote] = useState<{ key: string; page: RemotePage } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const query: AssetListQuery = {
    q: url.q,
    technology: url.technology,
    status: url.status,
    source: url.source,
    region: url.region,
    sort: url.sort,
    dir: url.dir,
    page: url.page,
    pageSize: rows.length > 0 ? Math.max(rows.length, 1) : 25,
  };
  const defaults = !client || isDefaultAssetQuery(query, url.preset ?? null);
  const requestKey = `${url.preset ?? ""}\n${url.q}\n${url.technology ?? ""}\n${url.status ?? ""}\n${url.source ?? ""}\n${url.region}\n${url.sort}\n${url.dir}\n${url.page}`;
  const failed = client && !defaults && failedKey === requestKey;
  const loading = client && !defaults && remote?.key !== requestKey && !failed;

  useEffect(() => {
    if (!client || isDefaultAssetQuery(
      {
        q: url.q,
        technology: url.technology,
        status: url.status,
        source: url.source,
        region: url.region,
        sort: url.sort,
        dir: url.dir,
        page: url.page,
        pageSize: 25,
      },
      url.preset ?? null,
    )) {
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (url.preset === "flows") {
      params.set("preset", "flows");
    }
    if (url.q) {
      params.set("q", url.q);
    }
    if (url.technology) {
      params.set("technology", url.technology);
    }
    if (url.status) {
      params.set("status", url.status);
    }
    if (url.source) {
      params.set("source", url.source);
    }
    if (url.region) {
      params.set("region", url.region);
    }
    if (url.sort !== "name") {
      params.set("sort", url.sort);
    }
    if (url.dir !== "asc") {
      params.set("dir", url.dir);
    }
    if (url.page !== 1) {
      params.set("page", String(url.page));
    }
    const queryString = params.toString();
    const key = requestKey;
    fetchBoundedJson(queryString ? `/assets/rows?${queryString}` : "/assets/rows", controller.signal)
      .then((body) => {
        if (controller.signal.aborted) {
          return;
        }
        if (!isRemotePage(body)) {
          setFailedKey(key);
          return;
        }
        setRemote({ key, page: body });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        setFailedKey(key);
      });
    return () => controller.abort();
  }, [client, requestKey, url.dir, url.page, url.preset, url.q, url.region, url.sort, url.source, url.status, url.technology]);

  const loaded = !defaults && remote?.key === requestKey ? remote.page : null;
  const result = defaults
    ? { rows, total, page: 1, pages }
    : {
        rows: loaded?.assets ?? [],
        total: loaded?.total,
        page: loaded?.page ?? url.page,
        pages: loaded?.pages ?? 1,
      };
  const technologyOptions =
    client && url.preset === "flows"
      ? technologies.filter((technology) => technology === "interconnector" || technology === "gas_terminal")
      : technologies;

  function toggleSort(sort: AssetSort) {
    if (url.sort === sort) {
      void setUrl({ dir: url.dir === "asc" ? "desc" : "asc", page: 1 });
      return;
    }
    void setUrl({ sort, dir: sort === "mw" ? "desc" : "asc", page: 1 });
  }

  return (
    <Card
      title={url.preset === "flows" ? "Flows" : "Assets"}
      footer={
        <nav aria-label="Pagination" className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex h-8 min-h-11 items-center rounded-md border border-gray-alpha-400 px-3 text-label-13 text-gray-1000 disabled:opacity-40 sm:min-h-8"
            disabled={result.page <= 1}
            onClick={() => void setUrl({ page: result.page - 1 })}
          >
            Previous
          </button>
          <p>
            Page {result.page} of {result.pages}
          </p>
          <button
            type="button"
            className="inline-flex h-8 min-h-11 items-center rounded-md border border-gray-alpha-400 px-3 text-label-13 text-gray-1000 disabled:opacity-40 sm:min-h-8"
            disabled={result.page >= result.pages}
            onClick={() => void setUrl({ page: result.page + 1 })}
          >
            Next
          </button>
        </nav>
      }
    >
      <details className="rounded-lg border border-gray-alpha-400 px-3 py-2">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-copy-14 text-gray-1000">
          Filters
          <span className="rounded-md border border-gray-alpha-400 px-2 py-0.5 text-label-13 text-gray-900">
            {activeFilters(url)}
          </span>
        </summary>
      <form className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(event) => event.preventDefault()}>
        <label className="flex min-w-0 flex-col gap-1 text-label-13 text-gray-900 sm:col-span-2 lg:col-span-3">
          Search
          <input
            type="search"
            value={url.q}
            placeholder="Name, operator, technology, or location"
            onChange={(event) => void setUrl({ q: event.target.value, page: 1 })}
            className="h-11 w-full min-w-0 rounded-md border border-gray-alpha-400 bg-background-100 px-3 text-copy-16 text-gray-1000"
          />
        </label>
        <FilterSelect
          label="Technology"
          value={url.technology ?? ""}
          onChange={(value) => void setUrl({ technology: isAssetTechnology(value) ? value : null, page: 1 })}
          options={technologyOptions.map((technology) => ({ value: technology, label: technologyLabel(technology) }))}
        />
        <FilterSelect
          label="Status"
          value={url.status ?? ""}
          onChange={(value) => void setUrl({ status: value === "operational" ? "operational" : null, page: 1 })}
          options={[{ value: "operational", label: "Operational" }]}
        />
        <FilterSelect
          label="Source"
          value={url.source ?? ""}
          onChange={(value) => void setUrl({ source: isAssetSource(value) ? value : null, page: 1 })}
          options={ASSET_SOURCES.map((source) => ({ value: source, label: source }))}
        />
        <FilterSelect
          label="Region"
          value={url.region}
          onChange={(value) => void setUrl({ region: value, page: 1 })}
          options={regions.map((region) => ({ value: region, label: region }))}
        />
      </form>
      </details>
      <p className="mt-4 text-label-13 text-gray-900">
        {result.total == null
          ? "Loading assets"
          : `${result.total.toLocaleString("en-GB")} ${result.total === 1 ? "asset" : "assets"}`}
        {loading ? " · Loading" : ""}
      </p>
      {failed ? (
        <p className="mt-4 text-copy-14 text-gray-900" role="status">
          The list could not be loaded.
        </p>
      ) : null}
      {!failed && result.rows.length === 0 ? (
        <div className="mt-4">
          <p className="text-copy-14 text-gray-900">{loading ? "Loading assets." : "No assets match these filters."}</p>
          {loading ? null : (
            <button
              type="button"
              className="mt-3 inline-flex h-11 items-center rounded-md border border-gray-alpha-400 px-3 text-label-13 text-gray-1000"
              onClick={() => void setUrl({ q: "", technology: null, status: null, source: null, region: "", page: 1 })}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : result.rows.length > 0 ? (
        <TableScroll className="mt-3">
          <table className="w-full min-w-[40rem] border-collapse text-left text-copy-14">
            <caption className="sr-only">
              {url.preset === "flows" ? "Electricity interconnectors and gas entry points" : "Power assets"}
            </caption>
            <thead>
              <tr className="text-label-13 text-gray-900">
                {ASSET_SORTS.map((sort) => {
                  const current = url.sort === sort;
                  return (
                    <th
                      key={sort}
                      scope="col"
                      aria-sort={current ? (url.dir === "asc" ? "ascending" : "descending") : "none"}
                      className="relative border-b border-gray-alpha-400 py-2 pr-3 font-medium"
                    >
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center text-gray-1000 sm:min-h-8"
                        onClick={() => toggleSort(sort)}
                      >
                        {sortLabel(sort)}
                        {current ? <span className="sr-only">{url.dir === "asc" ? ", ascending" : ", descending"}</span> : null}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-alpha-400 last:border-b-0">
                  <th scope="row" className="py-3 pr-3 text-left font-medium text-gray-1000">
                    <Link href={assetHref(row)} className="text-blue-700 underline-offset-2 hover:underline">
                      {row.name}
                    </Link>
                  </th>
                  <td className="py-3 pr-3 text-gray-1000">{technologyLabel(row.technology)}</td>
                  <td className="py-3 pr-3 text-gray-1000">Operational</td>
                  <td className="py-3 pr-3 text-right tabular-nums text-gray-1000">{formatMw(row.mw)}</td>
                  <td className="py-3 pr-3 text-gray-1000">
                    {row.location === LOCATION_UNAVAILABLE ? LOCATION_UNAVAILABLE : row.region}
                  </td>
                  <td className="py-3 pr-3 text-gray-1000">{row.sources.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      ) : null}
    </Card>
  );
}

function activeFilters(url: {
  q: string;
  technology: string | null;
  status: string | null;
  source: string | null;
  region: string;
}): number {
  return [url.q, url.technology, url.status, url.source, url.region].filter((value) => value != null && value !== "").length;
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-label-13 text-gray-900">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full min-w-0 truncate rounded-md border border-gray-alpha-400 bg-background-100 px-2 text-copy-14 text-gray-1000"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
