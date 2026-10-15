"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Search } from "lucide-react";
import { formatMw, technologyLabel } from "@/lib/assets/labels";
import { ASSET_INDEX_PATH, decodeAssetIndex } from "@/lib/assets/index-file";
import { comboboxKeyMotion, searchAssets } from "@/lib/assets/query";
import type { AssetIndexRow } from "@/lib/assets/types";

const RESULT_LIMIT = 8;

let indexRequest: Promise<AssetIndexRow[]> | null = null;
let dialogOpen = false;
let opener: HTMLButtonElement | null = null;
const dialogListeners = new Set<() => void>();

function emitDialog() {
  for (const listener of dialogListeners) {
    listener();
  }
}

function subscribeDialog(listener: () => void) {
  dialogListeners.add(listener);
  return () => {
    dialogListeners.delete(listener);
  };
}

function showDialog(button: HTMLButtonElement | null) {
  opener = button;
  dialogOpen = true;
  emitDialog();
}

function hideDialog() {
  dialogOpen = false;
  emitDialog();
  opener?.focus();
}

function buttonShown(button: HTMLButtonElement | null): boolean {
  return Boolean(button && button.getClientRects().length > 0);
}

function loadSearchIndex(): Promise<AssetIndexRow[]> {
  if (!indexRequest) {
    indexRequest = fetch(ASSET_INDEX_PATH)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`asset index ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((body) => decodeAssetIndex(body));
  }
  return indexRequest;
}

export function AssetSearchButton() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const open = useSyncExternalStore(subscribeDialog, () => dialogOpen, () => false);

  return (
    <button
      ref={buttonRef}
      type="button"
      className="inline-flex h-8 min-h-11 min-w-11 items-center justify-center rounded-md border border-gray-alpha-400 bg-background-100 text-gray-1000 sm:min-h-8"
      aria-label="Search assets"
      aria-keyshortcuts="Control+K Meta+K"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => showDialog(buttonRef.current)}
    >
      <Search className="size-4" aria-hidden="true" />
    </button>
  );
}

export function AssetSearchDialogHost() {
  const open = useSyncExternalStore(subscribeDialog, () => dialogOpen, () => false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") {
        return;
      }
      event.preventDefault();
      const buttons = [...document.querySelectorAll<HTMLButtonElement>("[aria-label='Search assets']")];
      showDialog(buttons.find((button) => buttonShown(button)) ?? null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) {
    return null;
  }
  return createPortal(<AssetSearchDialog onClose={hideDialog} />, document.body);
}

function AssetSearchDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<AssetIndexRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const results = rows ? searchAssets(rows, query, RESULT_LIMIT) : [];
  const listOpen = !dismissed && results.length > 0;
  const activeIndex = results.length === 0 ? 0 : Math.min(active, results.length - 1);

  useEffect(() => {
    inputRef.current?.focus();
    let disposed = false;
    void loadSearchIndex()
      .then((index) => {
        if (!disposed) {
          setRows(index);
        }
      })
      .catch(() => {
        if (!disposed) {
          setFailed(true);
        }
      });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || dialogRef.current?.contains(target)) {
        return;
      }
      if (target instanceof Element && target.closest("[aria-label='Search assets']")) {
        return;
      }
      onClose();
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [onClose]);

  function select(index: number) {
    const hit = results[index];
    if (!hit) {
      return;
    }
    window.location.assign(`/assets/${hit.id}`);
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/40 px-4 py-16 sm:px-6">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search assets"
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
            length: results.length,
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
          Search the asset register
          <input
            ref={inputRef}
            id={`${listId}-input`}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={listOpen}
            aria-controls={listId}
            aria-activedescendant={listOpen && results[activeIndex] ? `${listId}-option-${activeIndex}` : undefined}
            value={query}
            placeholder="Name, operator, technology, or location"
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
              setDismissed(false);
            }}
            className="h-11 w-full min-w-0 rounded-md border border-gray-alpha-400 bg-background-100 px-3 text-copy-16 text-gray-1000"
          />
        </label>
        {failed ? (
          <p className="mt-3 text-copy-14 text-red-700" role="alert">
            Asset search is unavailable.
          </p>
        ) : null}
        {listOpen && results.length > 0 ? (
          <ul id={listId} role="listbox" aria-label="Matching assets" className="mt-3 flex max-h-80 flex-col overflow-y-auto">
            {results.map((row, index) => (
              <li key={row.id}>
                <Link
                  id={`${listId}-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  href={`/assets/${row.id}`}
                  className={`flex min-h-11 min-w-0 flex-col justify-center rounded-md px-2 py-1 ${
                    index === activeIndex ? "bg-gray-100" : ""
                  }`}
                  onMouseMove={() => setActive(index)}
                >
                  <span className="truncate text-copy-14 text-gray-1000">{row.name}</span>
                  <span className="truncate text-label-12 text-gray-900">
                    {technologyLabel(row.technology)} · {row.region} · {formatMw(row.mw)}
                    {row.operator ? ` · ${row.operator}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {rows && query.trim().length > 0 && results.length === 0 ? (
          <p className="mt-3 text-copy-14 text-gray-900">No matching stations.</p>
        ) : null}
        <p className="mt-3 text-label-12 text-gray-900">
          <Link
            href={query.trim() ? `/assets?q=${encodeURIComponent(query.trim())}` : "/assets"}
            className="text-blue-700 underline-offset-2 hover:underline"
          >
            Open the asset directory
          </Link>
        </p>
      </div>
    </div>
  );
}
