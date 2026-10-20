"use client";

import Link from "next/link";
import { useQueryStates } from "nuqs";
import { assetHref } from "@/lib/assets/href";
import { LOCATION_UNAVAILABLE, formatMw, technologyLabel } from "@/lib/assets/labels";
import { assetListParsers } from "@/lib/assets/params";
import { queryAssets } from "@/lib/assets/query";
import {
  ASSET_PAGE_SIZE,
  ASSET_SORTS,
  ASSET_SOURCES,
  DIRECTORY_TECHNOLOGIES,
  isAssetSource,
  isAssetTechnology,
  type AssetIndexRow,
  type AssetSort,
} from "@/lib/assets/types";
import { Card } from "@/components/ui/card";

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

export function AssetDirectory({
  rows,
  regions,
}: {
  rows: readonly AssetIndexRow[];
  regions: readonly string[];
}) {
  const [url, setUrl] = useQueryStates(assetListParsers, { history: "replace", shallow: true, scroll: false });
  const scoped =
    url.preset === "flows" ? rows.filter((row) => row.technology === "interconnector" || row.technology === "gas_terminal") : rows;
  const result = queryAssets(scoped, {
    q: url.q,
    technology: url.technology,
    status: url.status,
    source: url.source,
    region: url.region,
    sort: url.sort,
    dir: url.dir,
    page: url.page,
    pageSize: ASSET_PAGE_SIZE,
  });
  const technologies = DIRECTORY_TECHNOLOGIES.filter((technology) => scoped.some((row) => row.technology === technology));

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
      <form className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(event) => event.preventDefault()}>
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
          options={technologies.map((technology) => ({ value: technology, label: technologyLabel(technology) }))}
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
      <p className="mt-4 text-label-13 text-gray-900">
        {result.total.toLocaleString("en-GB")} {result.total === 1 ? "asset" : "assets"}
      </p>
      {result.rows.length === 0 ? (
        <p className="mt-4 text-copy-14 text-gray-900">No assets match these filters.</p>
      ) : (
        <div className="mt-3 min-w-0 overflow-x-auto">
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
                      className="border-b border-gray-alpha-400 py-2 pr-3 font-medium"
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
                  <td className="py-3 pr-3 text-gray-1000">{formatMw(row.mw)}</td>
                  <td className="py-3 pr-3 text-gray-1000">
                    {row.location === LOCATION_UNAVAILABLE ? LOCATION_UNAVAILABLE : row.region}
                  </td>
                  <td className="py-3 pr-3 text-gray-1000">{row.sources.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
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
