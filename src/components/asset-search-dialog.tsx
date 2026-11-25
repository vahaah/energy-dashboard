"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandStatus,
} from "@ui-sdk/react/command";
import { Dialog, DialogBackdrop, DialogContent, DialogTitle } from "@ui-sdk/react/dialog";
import { assetHref } from "@/lib/assets/href";
import { formatMw, technologyLabel } from "@/lib/assets/labels";
import { searchAssets } from "@/lib/assets/query";
import { loadSearchIndex } from "@/lib/assets/search-index";
import type { AssetIndexRow } from "@/lib/assets/types";
import {
  loadProjectSearchIndex,
  projectSearchHref,
  searchProjects,
  type ProjectSearchRow,
} from "@/lib/search/project-index";
import { compareCatalogueHits } from "@/lib/search/rank";
import { searchTasks } from "@/lib/search/tasks";

const CANDIDATE_LIMIT = 8;
const CATALOGUE_LIMIT = 8;

type Hit = {
  key: string;
  href: string;
  title: string;
  detail: string;
  group: "Pages" | "Projects" | "Assets";
};

function projectDetail(row: ProjectSearchRow): string {
  const parts = [row.stage, row.technology, row.place, row.mw === null ? "" : formatMw(row.mw)].filter(
    (part) => part.length > 0,
  );
  return parts.join(" · ");
}

function assetDetail(row: AssetIndexRow): string {
  return `${technologyLabel(row.technology)} · ${row.region} · ${formatMw(row.mw)}${row.operator ? ` · ${row.operator}` : ""}`;
}

function groupRuns(hits: readonly Hit[]): { group: Hit["group"]; items: Hit[] }[] {
  const runs: { group: Hit["group"]; items: Hit[] }[] = [];
  for (const hit of hits) {
    const last = runs.at(-1);
    if (!last || last.group !== hit.group) {
      runs.push({ group: hit.group, items: [hit] });
    } else {
      last.items.push(hit);
    }
  }
  return runs;
}

export function AssetSearchDialog({
  onClose,
  returnFocus,
}: {
  onClose: () => void;
  returnFocus: HTMLElement | null;
}) {
  const [query, setQuery] = useState("");
  const [assets, setAssets] = useState<AssetIndexRow[] | null>(null);
  const [projects, setProjects] = useState<ProjectSearchRow[] | null>(null);
  const [assetFailed, setAssetFailed] = useState(false);
  const [projectFailed, setProjectFailed] = useState(false);

  const tasks = searchTasks(query);
  const projectHits = projects ? searchProjects(projects, query, CANDIDATE_LIMIT) : [];
  const assetHits = assets ? searchAssets(assets, query, CANDIDATE_LIMIT) : [];
  const catalogue: Hit[] = [
    ...projectHits.map((row) => ({
      key: `project:${row.id}`,
      href: projectSearchHref(row),
      title: row.name,
      detail: projectDetail(row),
      group: "Projects" as const,
    })),
    ...assetHits.map((row) => ({
      key: `asset:${row.id}`,
      href: assetHref(row),
      title: row.name,
      detail: assetDetail(row),
      group: "Assets" as const,
    })),
  ];
  catalogue.sort((left, right) => compareCatalogueHits(query, left, right));
  const hits: Hit[] = [
    ...tasks.map((task) => ({
      key: `page:${task.id}`,
      href: task.href,
      title: task.title,
      detail: task.detail,
      group: "Pages" as const,
    })),
    ...catalogue.slice(0, CATALOGUE_LIMIT),
  ];
  const trimmed = query.trim();
  const registersLoading = (assets === null && !assetFailed) || (projects === null && !projectFailed);
  const status = trimmed.length > 0 && registersLoading && hits.length === 0 ? "loading" : "idle";

  useEffect(() => {
    let disposed = false;
    void loadSearchIndex()
      .then((index) => {
        if (!disposed) {
          setAssets(index);
        }
      })
      .catch(() => {
        if (!disposed) {
          setAssetFailed(true);
        }
      });
    void loadProjectSearchIndex()
      .then((index) => {
        if (!disposed) {
          setProjects(index);
        }
      })
      .catch(() => {
        if (!disposed) {
          setProjectFailed(true);
        }
      });
    return () => {
      disposed = true;
    };
  }, []);

  function openHit(value: string) {
    const hit = hits.find((item) => item.key === value);
    if (!hit) {
      return;
    }
    onClose();
    window.location.assign(hit.href);
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogBackdrop className="fixed inset-0 bg-black/40" />
      <DialogContent
        finalFocus={returnFocus ?? undefined}
        className="surface-card fixed top-[12dvh] left-1/2 z-40 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 overscroll-contain p-[var(--card-pad)]"
      >
        <DialogTitle className="sr-only">Search</DialogTitle>
        <Command
          query={query}
          onQueryChange={(next) => setQuery(next)}
          filter={false}
          status={status}
          onAction={openHit}
        >
          <label className="flex min-w-0 flex-col gap-2 text-label-13 text-gray-900">
            Search
            <CommandInput
              aria-label="Search"
              name="q"
              autoComplete="off"
              spellCheck={false}
              placeholder="Assets, projects, or a page…"
              className="h-11 w-full min-w-0 rounded-md border border-gray-alpha-400 bg-background-100 px-3 text-copy-16 text-gray-1000"
            />
          </label>
          {assetFailed ? (
            <p className="mt-3 text-copy-14 text-red-700" role="alert">
              Asset search is unavailable.
            </p>
          ) : null}
          {projectFailed ? (
            <p className="mt-3 text-copy-14 text-red-700" role="alert">
              Project search is unavailable.
            </p>
          ) : null}
          <CommandStatus className="sr-only">
            {(state) =>
              state.loading
                ? "Loading the registers…"
                : state.count === 0
                  ? trimmed.length > 0
                    ? "No matching pages, projects, or assets."
                    : ""
                  : `${state.count} ${state.count === 1 ? "result" : "results"}`
            }
          </CommandStatus>
          <CommandEmpty className="mt-3 text-copy-14 text-gray-900">
            {trimmed.length > 0 && registersLoading
              ? "Loading the registers…"
              : "No matching pages, projects, or assets."}
          </CommandEmpty>
          <CommandList className="mt-3 flex max-h-[min(32rem,calc(100dvh-14rem))] flex-col overflow-y-auto overscroll-contain">
            {groupRuns(hits).map((run) => (
              <CommandGroup key={`${run.group}:${run.items[0]?.key}`}>
                <CommandGroupLabel className="px-2 pt-2 text-label-12 text-gray-900">{run.group}</CommandGroupLabel>
                {run.items.map((hit) => (
                  <CommandItem
                    key={hit.key}
                    value={hit.key}
                    label={hit.title}
                    render={<Link href={hit.href} />}
                    className="flex min-h-11 min-w-0 flex-col justify-center rounded-md px-2 py-1 data-highlighted:bg-gray-100"
                  >
                    <span className="truncate text-copy-14 text-gray-1000">{hit.title}</span>
                    <span className="truncate text-label-12 text-gray-900">{hit.detail}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
        <p className="mt-3 flex flex-col gap-2 text-label-12 text-gray-900 sm:flex-row sm:flex-wrap sm:gap-x-4">
          <Link
            href={trimmed ? `/assets?q=${encodeURIComponent(trimmed)}` : "/assets"}
            className="text-blue-700 underline-offset-2 hover:underline"
            onClick={() => onClose()}
          >
            Open the asset directory
          </Link>
          <Link
            href={trimmed ? `/projects?q=${encodeURIComponent(trimmed.slice(0, 80))}` : "/projects"}
            className="text-blue-700 underline-offset-2 hover:underline"
            onClick={() => onClose()}
          >
            {trimmed ? `Search projects for "${trimmed.slice(0, 80)}"` : "Open the projects register"}
          </Link>
        </p>
      </DialogContent>
    </Dialog>
  );
}
