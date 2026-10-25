"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Quantity } from "@/components/ui/quantity";
import { formatEnergy } from "@/lib/format/quantity";
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

const HIDDEN_STATUS = "Unknown";

export function ProjectsBoard({ document }: { document: ProjectsDocument }) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("all");
  const [technology, setTechnology] = useState("all");
  const [nation, setNation] = useState("all");
  const [page, setPage] = useState(1);
  const stages = useMemo(
    () => unique(document.rows.map((row) => row.displayStage).filter((value) => value !== HIDDEN_STATUS)),
    [document.rows],
  );
  const technologies = useMemo(() => unique(document.rows.map((row) => row.technology)), [document.rows]);
  const nations = useMemo(
    () => unique(document.rows.map((row) => row.nation).filter((value) => value !== "Northern Ireland")),
    [document.rows],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return document.rows.filter((row) => {
      if (stage !== "all" && row.displayStage !== stage) {
        return false;
      }
      if (technology !== "all" && row.technology !== technology) {
        return false;
      }
      if (nation !== "all" && row.nation !== nation) {
        return false;
      }
      if (needle.length === 0) {
        return true;
      }
      return `${row.name} ${row.technology} ${row.displayStage} ${row.planning} ${row.construction} ${row.gate}`
        .toLowerCase()
        .includes(needle);
    });
  }, [document.rows, nation, query, stage, technology]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const slice = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 lg:col-span-4">
        <Card size="stat" title={OPERATING_RATED_POWER} className="h-full">
          <p className="min-w-0 break-words text-heading-32 text-gray-1000">
            <EnergyHeadline mw={document.operating.total} />
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
            <EnergyHeadline mw={document.connection.total} />
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
            <ul className="grid min-w-0 gap-3 sm:grid-cols-2">
              {document.shares.map((share) => {
                const energy = formatEnergy(share.mw);
                return (
                  <li key={share.technology} className="min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="break-words text-copy-14 text-gray-1000">{share.label}</span>
                      <span className="shrink-0 text-label-13 tabular-nums text-gray-900">
                        {energy.value} {energy.unit} · {share.percentLabel}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-gray-200" aria-hidden="true">
                      <div
                        className="h-1.5 rounded-sm"
                        style={{ width: `${share.percent}%`, backgroundColor: technologyColor(share.technology) }}
                      />
                    </div>
                  </li>
                );
              })}
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
          <div className="grid min-w-0 gap-3 sm:grid-cols-3">
            <Filter label="Stage" value={stage} onChange={(value) => { setStage(value); setPage(1); }}>
              <option value="all">All stages</option>
              {stages.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </Filter>
            <Filter label="Technology" value={technology} onChange={(value) => { setTechnology(value); setPage(1); }}>
              <option value="all">All technologies</option>
              {technologies.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </Filter>
            <Filter label="Nation" value={nation} onChange={(value) => { setNation(value); setPage(1); }}>
              <option value="all">England, Scotland and Wales</option>
              {nations.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </Filter>
          </div>
          <label className="mt-3 flex min-w-0 flex-col gap-1 text-label-13 text-gray-900">
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
            <ul className="mt-2 min-w-0">
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

function EnergyHeadline({ mw }: { mw: number }) {
  const energy = formatEnergy(mw);
  return <Quantity value={energy.value} unit={energy.unit} />;
}

function ProjectLine({ row }: { row: ProjectIndexRow }) {
  const statuses = [
    row.planning === HIDDEN_STATUS ? null : `Planning ${row.planning}`,
    row.construction === HIDDEN_STATUS ? null : `Construction ${row.construction}`,
    row.gate === HIDDEN_STATUS ? null : row.gate,
  ].filter((part): part is string => part !== null);
  const stage = row.displayStage === HIDDEN_STATUS ? row.technology : `${row.technology} · ${row.displayStage}`;
  return (
    <li className="min-w-0 border-b border-gray-alpha-400 last:border-b-0">
      <Link
        href={row.href}
        className="group flex min-h-11 items-start justify-between gap-3 rounded-md py-3 hover:bg-background-200 focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:outline-none"
      >
        <span className="min-w-0">
          <span className="block break-words text-copy-16 text-gray-1000 group-hover:underline">{row.name}</span>
          <span className="mt-1 block break-words text-label-13 text-gray-900">{stage}</span>
          {statuses.length > 0 ? (
            <span className="mt-1 block break-words text-label-13 text-gray-900">{statuses.join(" · ")}</span>
          ) : null}
          <span className="mt-1 block break-words text-label-13 text-gray-1000">
            Rated power {row.power} · Connection capacity {row.connection}
          </span>
        </span>
        <span aria-hidden="true" className="text-copy-16 text-gray-900">
          ›
        </span>
      </Link>
    </li>
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
        className="h-11 w-full min-w-0 rounded-md border border-gray-alpha-400 bg-background-100 px-3 text-copy-16 text-gray-1000"
      >
        {children}
      </select>
    </label>
  );
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function technologyColor(technology: string): string {
  switch (technology) {
    case "offshore_wind":
    case "onshore_wind":
      return "var(--chart-wind)";
    case "solar_pv":
      return "var(--chart-solar)";
    case "ccgt":
    case "ocgt":
    case "gas_reciprocating":
      return "var(--chart-gas)";
    case "nuclear":
      return "var(--chart-nuclear)";
    case "biomass":
    case "energy_from_waste":
      return "var(--chart-biomass)";
    case "battery":
      return "var(--chart-battery)";
    case "pumped_storage":
    case "hydro":
      return "var(--chart-hydro)";
    case "oil":
      return "var(--chart-oil)";
    default:
      return "var(--chart-other)";
  }
}
