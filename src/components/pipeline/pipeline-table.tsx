"use client";

import Link from "next/link";
import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { PIPELINE_CSV_PATH, PIPELINE_NOT_PUBLISHED } from "@/lib/pipeline/copy";
import { pipelineCsv } from "@/lib/pipeline/csv";
import { stageLabel, type PipelineStageId, type PipelineTableRow } from "@/lib/pipeline/model";

const PAGE_SIZE = 40;

type SortKey = "name" | "stage" | "technology" | "nation" | "capacity" | "statusDate";

const STAGE_ORDER: Record<PipelineStageId, number> = {
  under_construction: 0,
  consented: 1,
  in_planning: 2,
};

export function PipelineTable({ rows }: { rows: PipelineTableRow[] }) {
  const [stage, setStage] = useState("all");
  const [technology, setTechnology] = useState("all");
  const [nation, setNation] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "capacity", direction: "desc" });
  const [page, setPage] = useState(1);

  const technologies = useMemo(() => unique(rows.map((row) => row.technologyLabel)), [rows]);
  const nations = useMemo(() => unique(rows.map((row) => row.nation)), [rows]);
  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        if (stage !== "all" && row.stage !== stage) {
          return false;
        }
        if (technology !== "all" && row.technologyLabel !== technology) {
          return false;
        }
        if (nation !== "all" && row.nation !== nation) {
          return false;
        }
        return true;
      }),
    [nation, rows, stage, technology],
  );
  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((left, right) => compareRows(left, right, sort.key, sort.direction));
    return copy;
  }, [filtered, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const slice = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function toggle(key: SortKey) {
    setPage(1);
    setSort((currentSort) =>
      currentSort.key === key
        ? { key, direction: currentSort.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "capacity" || key === "statusDate" ? "desc" : "asc" },
    );
  }

  function download(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const blob = new Blob([pipelineCsv(sorted)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "gb-renewable-storage-pipeline.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card
      title="Projects"
      actions={
        <a
          href={PIPELINE_CSV_PATH}
          onClick={download}
          className="inline-flex h-11 items-center text-copy-14 text-blue-700 underline-offset-2 hover:underline"
        >
          Download CSV
        </a>
      }
      footer={
        <nav aria-label="Pagination" className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex h-11 items-center rounded-md border border-gray-alpha-400 px-3 text-label-13 text-gray-1000 disabled:opacity-40"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </button>
          <p>
            Page {current} of {pages}
          </p>
          <button
            type="button"
            className="inline-flex h-11 items-center rounded-md border border-gray-alpha-400 px-3 text-label-13 text-gray-1000 disabled:opacity-40"
            disabled={current >= pages}
            onClick={() => setPage(current + 1)}
          >
            Next
          </button>
        </nav>
      }
    >
      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        <Filter label="Stage" value={stage} onChange={(value) => { setStage(value); setPage(1); }}>
          <option value="all">All stages</option>
          <option value="under_construction">Under construction</option>
          <option value="consented">Consented</option>
          <option value="in_planning">In planning</option>
        </Filter>
        <Filter label="Technology" value={technology} onChange={(value) => { setTechnology(value); setPage(1); }}>
          <option value="all">All technologies</option>
          {technologies.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Filter>
        <Filter label="Nation" value={nation} onChange={(value) => { setNation(value); setPage(1); }}>
          <option value="all">All nations</option>
          {nations.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Filter>
      </div>
      <p className="mt-4 text-label-13 text-gray-900">
        {sorted.length.toLocaleString("en-GB")} {sorted.length === 1 ? "project" : "projects"}
      </p>
      {slice.length === 0 ? (
        <p className="mt-4 break-words text-copy-14 text-gray-900">No projects match.</p>
      ) : (
        <div className="mt-3 max-w-full overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left">
            <caption className="sr-only">Renewable and storage projects in the GB pipeline</caption>
            <thead>
              <tr className="border-b border-gray-alpha-400 text-label-13 text-gray-900">
                <SortHeader label="Project" sortKey="name" sort={sort} onSort={toggle} />
                <SortHeader label="Stage" sortKey="stage" sort={sort} onSort={toggle} />
                <SortHeader label="Technology" sortKey="technology" sort={sort} onSort={toggle} />
                <SortHeader label="Nation" sortKey="nation" sort={sort} onSort={toggle} />
                <SortHeader label="Capacity" sortKey="capacity" sort={sort} onSort={toggle} />
                <SortHeader label="Status date" sortKey="statusDate" sort={sort} onSort={toggle} />
              </tr>
            </thead>
            <tbody>
              {slice.map((row) => (
                <tr key={row.ref} className="border-b border-gray-alpha-400 align-top">
                  <td className="max-w-64 min-w-0 py-3 pr-3">
                    {row.href ? (
                      <Link href={row.href} className="break-words text-copy-14 text-blue-700 underline-offset-2 hover:underline">
                        {row.name}
                      </Link>
                    ) : (
                      <span className="break-words text-copy-14 text-gray-1000">{row.name}</span>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-copy-14 text-gray-1000">{stageLabel(row.stage)}</td>
                  <td className="py-3 pr-3 text-copy-14 text-gray-1000">{row.technologyLabel}</td>
                  <td className="py-3 pr-3 text-copy-14 text-gray-1000">{row.nation}</td>
                  <td className="py-3 pr-3 text-copy-14 text-gray-1000 tabular-nums">{row.capacityLabel}</td>
                  <td className="py-3 text-copy-14 text-gray-1000">{row.statusDateLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 break-words text-label-12 text-gray-900">
        Capacity is rated power. {PIPELINE_NOT_PUBLISHED} means the extract has no megawatt figure.
      </p>
    </Card>
  );
}

function Filter({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-label-13 text-gray-900">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full min-w-0 max-w-full rounded-md border border-gray-alpha-400 bg-background-100 px-3 text-copy-16 text-gray-1000"
      >
        {children}
      </select>
    </label>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; direction: "asc" | "desc" };
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  const arrow = active ? (sort.direction === "asc" ? "↑" : "↓") : "";
  return (
    <th scope="col" className="py-2 pr-3 font-normal">
      <button type="button" className="inline-flex h-11 items-center gap-1 text-left" onClick={() => onSort(sortKey)}>
        {label}
        <span aria-hidden="true">{arrow}</span>
        {active ? <span className="sr-only">{sort.direction === "asc" ? "ascending" : "descending"}</span> : null}
      </button>
    </th>
  );
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function compareRows(left: PipelineTableRow, right: PipelineTableRow, key: SortKey, direction: "asc" | "desc"): number {
  const sign = direction === "asc" ? 1 : -1;
  const base = compareKey(left, right, key);
  if (base !== 0) {
    return base * sign;
  }
  return left.name.localeCompare(right.name);
}

function compareKey(left: PipelineTableRow, right: PipelineTableRow, key: SortKey): number {
  switch (key) {
    case "name":
      return left.name.localeCompare(right.name);
    case "stage":
      return STAGE_ORDER[left.stage] - STAGE_ORDER[right.stage];
    case "technology":
      return left.technologyLabel.localeCompare(right.technologyLabel);
    case "nation":
      return left.nation.localeCompare(right.nation);
    case "capacity":
      return (left.mw ?? Number.NEGATIVE_INFINITY) - (right.mw ?? Number.NEGATIVE_INFINITY);
    case "statusDate":
      return (left.statusDate ?? "").localeCompare(right.statusDate ?? "");
    default: {
      const neverKey: never = key;
      throw new Error(`Unknown sort ${String(neverKey)}`);
    }
  }
}
