"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { DataStateNotice } from "@/components/ui/data-state";
import { formatLondonDateLabel, formatLondonDayMonthYear, formatVisibleInstants, parseUtcDateTime } from "@/lib/london-time";

export type ChangeCard = {
  key: string;
  name: string;
  href: string | null;
  sentence: string;
  evidence: string;
  status: string | null;
  observedAt: string;
  effectiveAt: string | null;
  fieldLabel?: string;
  oldLabel?: string;
  newLabel?: string;
};

export function ChangesBoard({ rows, attribution }: { rows: ChangeCard[]; attribution: string }) {
  const types = [...new Set(rows.map((row) => row.fieldLabel).filter((label): label is string => Boolean(label)))];
  const [selected, setSelected] = useState<string>("all");
  if (rows.length === 0) {
    return (
      <Card title="Changes">
        <DataStateNotice state="not_yet_available" />
      </Card>
    );
  }
  const visible = selected === "all" ? rows : rows.filter((row) => row.fieldLabel === selected);
  const days = groupByDay(visible);
  return (
    <Card title="Changes" footer={<p className="break-words">{attribution}</p>}>
      <div className="flex min-w-0 flex-col">
        <p className="text-copy-14 text-gray-900">
          {rows.length} {rows.length === 1 ? "change" : "changes"}
        </p>
        {types.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Change type">
            <FilterChip pressed={selected === "all"} onClick={() => setSelected("all")} label="All" />
            {types.map((type) => (
              <FilterChip key={type} pressed={selected === type} onClick={() => setSelected(type)} label={type} />
            ))}
          </div>
        ) : null}
        {days.map((day) => (
          <section key={day.label} className="mt-6">
            <h2 className="text-label-13 text-gray-900">Found {day.label}</h2>
            {day.projects.map((project) => (
              <article key={project.key} className="mt-4 min-w-0 border-t border-gray-alpha-400 pt-4">
                <h3 className="break-words text-heading-16 text-gray-1000">
                  {project.href ? (
                    <Link href={project.href} className="text-blue-700 underline-offset-2 hover:underline">
                      {project.name}
                    </Link>
                  ) : (
                    project.name
                  )}
                </h3>
                <ul className="mt-2 flex flex-col gap-2">
                  {project.rows.map((row) => (
                    <li key={row.key} className="min-w-0">
                      {row.oldLabel && row.newLabel ? (
                        <p className="flex flex-wrap items-center gap-2 text-copy-14 text-gray-1000">
                          <span className="text-gray-900">{row.fieldLabel}</span>
                          <span className="inline-flex min-h-6 items-center rounded-md border border-gray-alpha-400 px-1.5">
                            {row.oldLabel}
                          </span>
                          <span aria-hidden="true">→</span>
                          <span className="inline-flex min-h-6 items-center rounded-md border border-gray-alpha-400 px-1.5">
                            {row.newLabel}
                          </span>
                        </p>
                      ) : (
                        <p className="break-words text-copy-14 text-gray-1000">{row.sentence}</p>
                      )}
                      <p className="mt-1 break-words text-copy-14 text-gray-900">{formatVisibleInstants(row.evidence)}</p>
                      {row.status ? <p className="mt-1 break-words text-copy-14 text-gray-900">{row.status}</p> : null}
                      {row.effectiveAt ? (
                        <p className="mt-1 break-words text-copy-14 text-gray-900">Effective {displayWhen(row.effectiveAt)}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </section>
        ))}
      </div>
    </Card>
  );
}

function FilterChip({ pressed, onClick, label }: { pressed: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex h-11 min-h-11 items-center rounded-md border px-3 text-label-13 capitalize sm:h-8 sm:min-h-8 ${
        pressed ? "border-gray-1000 text-gray-1000" : "border-gray-alpha-400 text-gray-900"
      }`}
    >
      {label}
    </button>
  );
}

function groupByDay(rows: ChangeCard[]): { label: string; projects: { key: string; name: string; href: string | null; rows: ChangeCard[] }[] }[] {
  const days: { label: string; projects: { key: string; name: string; href: string | null; rows: ChangeCard[] }[] }[] = [];
  for (const row of rows) {
    const label = observedDay(row.observedAt);
    let day = days.find((item) => item.label === label);
    if (!day) {
      day = { label, projects: [] };
      days.push(day);
    }
    const key = row.href ?? row.name;
    let project = day.projects.find((item) => item.key === key);
    if (!project) {
      project = { key, name: row.name, href: row.href, rows: [] };
      day.projects.push(project);
    }
    project.rows.push(row);
  }
  return days;
}

function observedDay(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return formatLondonDayMonthYear(value);
  }
  return formatLondonDateLabel(parseUtcDateTime(value));
}

function displayWhen(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return formatLondonDayMonthYear(value);
  }
  return formatVisibleInstants(value);
}
