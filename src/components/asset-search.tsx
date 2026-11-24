"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { Search } from "lucide-react";

/**
 * The dialog chunk, /search/assets.json and /search/projects.json load on the
 * first open. The header button stays on every page, including /, without that
 * code in the initial bundle.
 */
const AssetSearchDialog = dynamic(
  () => import("@/components/asset-search-dialog").then((module) => module.AssetSearchDialog),
  { ssr: false },
);

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
  // The dialog's cleanup removes `inert` after this call. Focusing inside an
  // inert header does nothing, so wait until that cleanup has run.
  window.setTimeout(() => opener?.focus(), 0);
}

function buttonShown(button: HTMLButtonElement | null): boolean {
  return Boolean(button && button.getClientRects().length > 0);
}

export function AssetSearchButton() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const open = useSyncExternalStore(subscribeDialog, () => dialogOpen, () => false);

  return (
    <button
      ref={buttonRef}
      type="button"
      className="inline-flex h-8 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md border border-gray-alpha-400 bg-background-100 text-gray-1000 sm:min-h-8"
      aria-label="Search"
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
      const buttons = [...document.querySelectorAll<HTMLButtonElement>("[aria-label='Search']")];
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
