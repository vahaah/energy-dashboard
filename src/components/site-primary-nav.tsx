"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  adjacentTabStop,
  isNavCurrent,
  menuKeyMotion,
  overlayMenuBox,
  visibleHeaderNav,
  type SiteNavMenuItem,
} from "@/lib/site-nav";

const LINK_CLASS =
  "inline-flex min-h-11 items-center whitespace-nowrap rounded-sm text-label-13 focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:outline-none sm:min-h-8";

const TABBABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function headerTabStops(trigger: HTMLElement): HTMLElement[] {
  return [...trigger.ownerDocument.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)].filter((node) => {
    if (node.closest('[role="menu"]')) {
      return false;
    }
    if (node.tabIndex < 0) {
      return false;
    }
    return node.getClientRects().length > 0;
  });
}

export function SitePrimaryNav({
  pathname,
  idPrefix,
  className = "",
  compact = false,
}: {
  pathname: string;
  idPrefix: string;
  className?: string;
  compact?: boolean;
}) {
  const items = visibleHeaderNav();
  const rowClass = compact
    ? "flex w-max flex-nowrap items-center gap-x-4"
    : "flex flex-wrap items-center gap-x-4 gap-y-1";
  return (
    <nav aria-label="Primary" className={`${rowClass} ${className}`.trim()}>
      {items.map((item) => {
        switch (item.kind) {
          case "link": {
            const current = isNavCurrent(item.href, pathname);
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`${LINK_CLASS} ${current ? "text-gray-1000" : "text-gray-900 hover:text-gray-1000"}`}
              >
                {compact && item.compactLabel ? item.compactLabel : item.label}
              </Link>
            );
          }
          case "menu":
            return (
              <SiteNavMenu
                key={item.id}
                label={item.label}
                shownLabel={compact && item.compactLabel ? item.compactLabel : item.label}
                items={item.items}
                pathname={pathname}
                menuId={`${idPrefix}-${item.id}`}
                overlay={compact}
              />
            );
          default: {
            const exhaustive: never = item;
            return exhaustive;
          }
        }
      })}
    </nav>
  );
}

export function ConnectedSitePrimaryNav({
  idPrefix,
  className = "",
  compact = false,
}: {
  idPrefix: string;
  className?: string;
  compact?: boolean;
}) {
  const pathname = usePathname() || "/";
  return <SitePrimaryNav pathname={pathname} idPrefix={idPrefix} className={className} compact={compact} />;
}

function SiteNavMenu({
  label,
  shownLabel,
  items,
  pathname,
  menuId,
  overlay,
}: {
  label: string;
  shownLabel: string;
  items: SiteNavMenuItem[];
  pathname: string;
  menuId: string;
  overlay: boolean;
}) {
  const reactId = useId();
  const id = menuId || reactId;
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const current = items.some((item) => isNavCurrent(item.href, pathname));

  useEffect(() => {
    if (!open) {
      return;
    }
    itemRefs.current[index]?.focus();
  }, [open, index]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  useEffect(() => {
    if (!open || !overlay) {
      return;
    }
    const close = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open, overlay]);

  function bindMenu(node: HTMLDivElement | null) {
    menuRef.current = node;
    if (!node || !overlay) {
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const box = overlayMenuBox({
      trigger: { top: rect.top, bottom: rect.bottom, left: rect.left },
      menuWidth: node.offsetWidth,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
    node.style.top = box.top === null ? "auto" : `${box.top}px`;
    node.style.bottom = box.bottom === null ? "auto" : `${box.bottom}px`;
    node.style.left = `${box.left}px`;
    node.style.maxHeight = `${box.maxHeight}px`;
    node.style.visibility = "visible";
  }

  function onMenuKeyDown(event: ReactKeyboardEvent, target: "button" | "item") {
    if (event.key === "Tab" && overlay && open) {
      event.preventDefault();
      const trigger = buttonRef.current;
      setOpen(false);
      if (trigger) {
        const next = adjacentTabStop(headerTabStops(trigger), trigger, event.shiftKey);
        (next ?? trigger).focus();
      }
      return;
    }
    if (applyKey(event.key, target) && event.key !== "Tab") {
      event.preventDefault();
    }
  }

  function applyKey(key: string, target: "button" | "item") {
    const motion = menuKeyMotion({ key, open, index, length: items.length, target });
    switch (motion.type) {
      case "open":
        setIndex(motion.index);
        setOpen(true);
        break;
      case "close":
        setOpen(false);
        if (motion.restore) {
          buttonRef.current?.focus();
        }
        break;
      case "move":
        setIndex(motion.index);
        break;
      case "none":
        break;
      default: {
        const exhaustive: never = motion;
        return exhaustive;
      }
    }
    return motion.type !== "none";
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-current={current ? "page" : undefined}
        className={`${LINK_CLASS} gap-1 ${current ? "text-gray-1000" : "text-gray-900 hover:text-gray-1000"}`}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => onMenuKeyDown(event, "button")}
      >
        {shownLabel}
        <ChevronDown className={`size-3.5 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open ? (
        <NavMenuPanel
          id={id}
          label={label}
          items={items}
          pathname={pathname}
          index={index}
          overlay={overlay}
          menuRef={bindMenu}
          itemRefs={itemRefs}
          onClose={() => setOpen(false)}
          onKeyDown={onMenuKeyDown}
        />
      ) : null}
    </div>
  );
}

function NavMenuPanel({
  id,
  label,
  items,
  pathname,
  index,
  overlay,
  menuRef,
  itemRefs,
  onClose,
  onKeyDown,
}: {
  id: string;
  label: string;
  items: SiteNavMenuItem[];
  pathname: string;
  index: number;
  overlay: boolean;
  menuRef: (node: HTMLDivElement | null) => void;
  itemRefs: { current: Array<HTMLAnchorElement | null> };
  onClose: () => void;
  onKeyDown: (event: ReactKeyboardEvent, target: "button" | "item") => void;
}) {
  const panel = (
    <div
      ref={menuRef}
      id={id}
      role="menu"
      aria-label={label}
      className={
        overlay
          ? "fixed z-30 min-w-48 max-w-[calc(100vw-16px)] overflow-y-auto rounded-lg border border-gray-alpha-400 bg-background-100 py-1"
          : "absolute top-full left-0 z-30 mt-1 min-w-48 rounded-lg border border-gray-alpha-400 bg-background-100 py-1"
      }
      style={overlay ? { visibility: "hidden" } : undefined}
    >
      {items.map((item, itemIndex) => {
        const itemCurrent = isNavCurrent(item.href, pathname);
        return (
          <div key={item.id}>
            {item.dividerBefore ? (
              <p className="border-t border-gray-alpha-400 px-3 pt-2 pb-1 text-label-12 text-gray-900">
                {item.dividerBefore}
              </p>
            ) : null}
            <Link
              href={item.href}
              role="menuitem"
              ref={(node) => {
                itemRefs.current[itemIndex] = node;
              }}
              aria-current={itemCurrent ? "page" : undefined}
              tabIndex={itemIndex === index ? 0 : -1}
              className={`flex min-h-11 items-center px-3 text-label-13 break-words focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:outline-none ${
                itemCurrent ? "text-gray-1000" : "text-gray-900 hover:text-gray-1000"
              }`}
              onClick={onClose}
              onKeyDown={(event) => onKeyDown(event, "item")}
            >
              {item.label}
            </Link>
          </div>
        );
      })}
    </div>
  );
  if (overlay && typeof document !== "undefined") {
    return createPortal(panel, document.body);
  }
  return panel;
}
