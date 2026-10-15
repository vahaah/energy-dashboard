"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  CONNECTION_CAPACITY,
  CONNECTION_DUPLICATE_WARNING,
  OPERATING_RATED_POWER,
  PROPOSED_EXCLUDED,
  RATED_POWER,
  STORAGE_ENERGY,
  STORAGE_ENERGY_UNPUBLISHED,
} from "@/lib/projects/copy";
import type { ProjectIndexRow, ProjectsDocument } from "@/lib/projects/page-model";

const PAGE_SIZE = 40;

export function ProjectsBoard({ document }: { document: ProjectsDocument }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) {
      return document.rows;
    }
    return document.rows.filter((row) =>
      `${row.name} ${row.technology} ${row.displayStage} ${row.planning} ${row.construction} ${row.gate}`
        .toLowerCase()
        .includes(needle),
    );
  }, [document.rows, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const slice = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 lg:col-span-4">
        <Card size="stat" title={OPERATING_RATED_POWER} className="h-full">
          <p className="min-w-0 break-words text-heading-32 text-gray-1000">
            {document.operating.totalLabel} <span className="text-copy-16 text-gray-900">MW</span>
          </p>
          <p className="mt-2 break-words text-label-12 text-gray-900">{RATED_POWER}, MW. {PROPOSED_EXCLUDED}</p>
          {document.operating.omitted > 0 ? (
            <p className="mt-2 break-words text-label-12 text-gray-900">
              {document.operating.omitted} operating records do not publish a rated power and are left out of this
              total.
            </p>
          ) : null}
        </Card>
      </div>
      <div className="col-span-12 lg:col-span-4">
        <Card size="stat" title={CONNECTION_CAPACITY} className="h-full">
          <p className="min-w-0 break-words text-heading-32 text-gray-1000">
            {document.connection.totalLabel} <span className="text-copy-16 text-gray-900">MW</span>
          </p>
          <p className="mt-2 break-words text-label-12 text-gray-900">Connection capacity, MW. {CONNECTION_DUPLICATE_WARNING}</p>
        </Card>
      </div>
      <div className="col-span-12 lg:col-span-4">
        <Card size="stat" title={STORAGE_ENERGY} className="h-full">
          {document.storage ? (
            <p className="text-heading-32 text-gray-1000">
              {document.storage.totalLabel} <span className="text-copy-16 text-gray-900">MWh</span>
            </p>
          ) : (
            <p className="break-words text-copy-14 text-gray-900">{STORAGE_ENERGY_UNPUBLISHED}</p>
          )}
        </Card>
      </div>

      {document.shares.length > 0 ? (
        <div className="col-span-12">
          <Card title="Operating rated power by technology">
            <ul className="grid min-w-0 gap-2 sm:grid-cols-2">
              {document.shares.map((share) => (
                <li key={share.technology} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="break-words text-copy-14 text-gray-1000">{share.label}</span>
                  <span className="text-label-13 text-gray-900">
                    {share.mwLabel} MW · {share.percentLabel}%
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}

      <div className="col-span-12">
        <Card
          title="Projects"
          footer={
            <nav aria-label="Pagination" className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                className="inline-flex h-8 min-h-11 items-center rounded-md border border-gray-alpha-400 px-3 text-label-13 text-gray-1000 disabled:opacity-40 sm:min-h-8"
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
                className="inline-flex h-8 min-h-11 items-center rounded-md border border-gray-alpha-400 px-3 text-label-13 text-gray-1000 disabled:opacity-40 sm:min-h-8"
                disabled={current >= pages}
                onClick={() => setPage(current + 1)}
              >
                Next
              </button>
            </nav>
          }
        >
          <label className="flex min-w-0 flex-col gap-1 text-label-13 text-gray-900">
            Search
            <input
              type="search"
              value={query}
              placeholder="Name, technology, or status"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              className="h-11 w-full min-w-0 rounded-md border border-gray-alpha-400 bg-background-100 px-3 text-copy-16 text-gray-1000"
            />
          </label>
          <p className="mt-4 text-label-13 text-gray-900">
            {filtered.length.toLocaleString("en-GB")} {filtered.length === 1 ? "project" : "projects"}
          </p>
          {slice.length === 0 ? (
            <p className="mt-4 break-words text-copy-14 text-gray-900">No projects match this search.</p>
          ) : (
            <ul className="mt-2 min-w-0 divide-y divide-gray-alpha-400">
              {slice.map((row) => (
                <ProjectLine key={row.id} row={row} />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function ProjectLine({ row }: { row: ProjectIndexRow }) {
  return (
    <li className="min-w-0 py-3">
      <Link href={row.href} className="break-words text-copy-16 text-blue-700 underline-offset-2 hover:underline">
        {row.name}
      </Link>
      <p className="mt-1 break-words text-label-13 text-gray-900">
        {row.technology} · {row.displayStage}
      </p>
      <p className="mt-1 break-words text-label-13 text-gray-900">
        Planning {row.planning} · Construction {row.construction} · {row.gate}
      </p>
      <p className="mt-1 break-words text-label-13 text-gray-1000">
        Rated power {row.power} · Connection capacity {row.connection}
      </p>
    </li>
  );
}
