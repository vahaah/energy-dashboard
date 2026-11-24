"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { assetHref } from "@/lib/assets/href";
import { formatMw, technologyLabel } from "@/lib/assets/labels";
import { comboboxKeyMotion, searchAssets } from "@/lib/assets/query";
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

export function AssetSearchDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [assets, setAssets] = useState<AssetIndexRow[] | null>(null);
  const [projects, setProjects] = useState<ProjectSearchRow[] | null>(null);
  const [assetFailed, setAssetFailed] = useState(false);
  const [projectFailed, setProjectFailed] = useState(false);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);

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
  const listOpen = !dismissed && hits.length > 0;
  const activeIndex = hits.length === 0 ? 0 : Math.min(active, hits.length - 1);
  const trimmed = query.trim();
  const registersLoading = (assets === null && !assetFailed) || (projects === null && !projectFailed);

  useEffect(() => {
    inputRef.current?.focus();
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

  useEffect(() => {
    if (!listOpen) {
      return;
    }
    document.getElementById(`${listId}-option-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listId, listOpen]);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || dialogRef.current?.contains(target)) {
        return;
      }
      if (target instanceof Element && target.closest("[aria-label='Search']")) {
        return;
      }
      onClose();
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [onClose]);

  function select(index: number) {
    const hit = hits[index];
    if (!hit) {
      return;
    }
    window.location.assign(hit.href);
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-black/40 px-4 py-8 sm:px-6 sm:py-16">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="surface-card mx-auto w-full max-w-xl p-[var(--card-pad)]"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !listOpen) {
            event.preventDefault();
            onClose();
            return;
          }
          if (event.key === "Tab") {
            const root = dialogRef.current;
            if (!root) {
              return;
            }
            const nodes = [...root.querySelectorAll<HTMLElement>("a, button, input")].filter(
              (node) => !node.hasAttribute("disabled"),
            );
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            if (!first || !last) {
              return;
            }
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
            return;
          }
          const motion = comboboxKeyMotion({
            key: event.key,
            open: listOpen,
            index: activeIndex,
            length: hits.length,
          });
          switch (motion.type) {
            case "open":
              setDismissed(false);
              setActive(motion.index);
              event.preventDefault();
              break;
            case "close":
              setDismissed(true);
              event.preventDefault();
              break;
            case "move":
              setActive(motion.index);
              event.preventDefault();
              break;
            case "select":
              event.preventDefault();
              select(motion.index);
              break;
            case "none":
              break;
            default: {
              const exhaustive: never = motion;
              return exhaustive;
            }
          }
        }}
      >
        <label className="flex min-w-0 flex-col gap-2 text-label-13 text-gray-900" htmlFor={`${listId}-input`}>
          Search
          <input
            ref={inputRef}
            id={`${listId}-input`}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={listOpen}
            aria-controls={listId}
            aria-activedescendant={listOpen && hits[activeIndex] ? `${listId}-option-${activeIndex}` : undefined}
            value={query}
            placeholder="Assets, projects, or a page"
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
              setDismissed(false);
            }}
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
        {trimmed.length > 0 && registersLoading && hits.length === 0 ? (
          <p className="mt-3 text-copy-14 text-gray-900" role="status">
            Loading the registers…
          </p>
        ) : null}
        {listOpen ? (
          <ul id={listId} role="listbox" aria-label="Search results" className="mt-3 flex max-h-[min(32rem,calc(100dvh-14rem))] flex-col overflow-y-auto">
            {hits.map((hit, index) => {
              const heading = index === 0 || hits[index - 1]?.group !== hit.group ? hit.group : null;
              return (
                <li key={hit.key} role="presentation">
                  {heading ? (
                    <p className="px-2 pt-2 text-label-12 text-gray-900" role="presentation">
                      {heading}
                    </p>
                  ) : null}
                  <Link
                    id={`${listId}-option-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    href={hit.href}
                    className={`flex min-h-11 min-w-0 flex-col justify-center rounded-md px-2 py-1 ${
                      index === activeIndex ? "bg-gray-100" : ""
                    }`}
                    onMouseMove={() => setActive(index)}
                    onClick={() => onClose()}
                  >
                    <span className="truncate text-copy-14 text-gray-1000">{hit.title}</span>
                    <span className="truncate text-label-12 text-gray-900">{hit.detail}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
        {trimmed.length > 0 && !registersLoading && hits.length === 0 ? (
          <p className="mt-3 text-copy-14 text-gray-900">No matching pages, projects, or assets.</p>
        ) : null}
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
      </div>
    </div>
  );
}
