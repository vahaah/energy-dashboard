"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Menu, MenuContent, MenuGroup, MenuGroupLabel, MenuItem, MenuTrigger } from "@ui-sdk/react/menu";
import { isNavCurrent, visibleHeaderNav, type SiteNavMenuItem } from "@/lib/site-nav";

const LINK_CLASS =
  "inline-flex min-h-11 items-center whitespace-nowrap rounded-sm text-label-13 focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:outline-none sm:min-h-8";

const ITEM_CLASS =
  "flex min-h-11 items-center px-3 text-label-13 break-words text-gray-900 data-highlighted:bg-gray-100 data-highlighted:text-gray-1000";

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
}: {
  label: string;
  shownLabel: string;
  items: SiteNavMenuItem[];
  pathname: string;
  menuId: string;
}) {
  const current = items.some((item) => isNavCurrent(item.href, pathname));
  return (
    <Menu>
      <MenuTrigger
        id={menuId}
        aria-current={current ? "page" : undefined}
        className={`group ${LINK_CLASS} gap-1 ${current ? "text-gray-1000" : "text-gray-900 hover:text-gray-1000"}`}
      >
        {shownLabel}
        <ChevronDown className="size-3.5 group-data-[open]:rotate-180" aria-hidden="true" />
      </MenuTrigger>
      <MenuContent
        aria-label={label}
        className="z-30 min-w-48 max-w-[calc(100vw-16px)] overflow-y-auto overscroll-contain rounded-lg border border-gray-alpha-400 bg-background-100 py-1"
      >
        {items.map((item) => {
          const itemCurrent = isNavCurrent(item.href, pathname);
          const link = (
            <MenuItem
              key={item.id}
              value={item.id}
              label={item.label}
              render={<Link href={item.href} aria-current={itemCurrent ? "page" : undefined} />}
              className={`${ITEM_CLASS} ${itemCurrent ? "text-gray-1000" : ""}`}
            >
              {item.label}
            </MenuItem>
          );
          if (!item.dividerBefore) {
            return link;
          }
          return (
            <MenuGroup key={item.id}>
              <MenuGroupLabel className="border-t border-gray-alpha-400 px-3 pt-2 pb-1 text-label-12 text-gray-900">
                {item.dividerBefore}
              </MenuGroupLabel>
              {link}
            </MenuGroup>
          );
        })}
      </MenuContent>
    </Menu>
  );
}
