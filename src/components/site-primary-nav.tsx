"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  isNavCurrent,
  menuKeyMotion,
  visibleHeaderNav,
  type SiteNavMenuItem,
} from "@/lib/site-nav";

const LINK_CLASS =
  "inline-flex min-h-11 items-center whitespace-nowrap rounded-sm text-label-13 focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:outline-none sm:min-h-8";

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
  return (
    <nav aria-label="Primary" className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${className}`.trim()}>
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
                items={item.items}
                pathname={pathname}
                menuId={`${idPrefix}-${item.id}`}
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
  items,
  pathname,
  menuId,
}: {
  label: string;
  items: SiteNavMenuItem[];
  pathname: string;
  menuId: string;
}) {
  const reactId = useId();
  const id = menuId || reactId;
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
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
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

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
        onKeyDown={(event) => {
          if (applyKey(event.key, "button") && event.key !== "Tab") {
            event.preventDefault();
          }
        }}
      >
        {label}
        <ChevronDown className={`size-3.5 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open ? (
        <div
          id={id}
          role="menu"
          aria-label={label}
          className="absolute top-full left-0 z-30 mt-1 min-w-48 rounded-lg border border-gray-alpha-400 bg-background-100 py-1"
        >
          {items.map((item, itemIndex) => {
            const itemCurrent = isNavCurrent(item.href, pathname);
            return (
              <Link
                key={item.id}
                href={item.href}
                role="menuitem"
                ref={(node) => {
                  itemRefs.current[itemIndex] = node;
                }}
                aria-current={itemCurrent ? "page" : undefined}
                tabIndex={itemIndex === index ? 0 : -1}
                className={`flex min-h-11 items-center px-3 text-label-13 focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:outline-none ${
                  itemCurrent ? "text-gray-1000" : "text-gray-900 hover:text-gray-1000"
                }`}
                onClick={() => setOpen(false)}
                onKeyDown={(event) => {
                  if (applyKey(event.key, "item") && event.key !== "Tab") {
                    event.preventDefault();
                  }
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
