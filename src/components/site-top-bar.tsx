"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AssetSearchButton, AssetSearchDialogHost } from "@/components/asset-search";
import { GridMark } from "@/components/grid-mark";
import { ConnectedSitePrimaryNav } from "@/components/site-primary-nav";
import { CARD_PAD_X } from "@/components/ui/card";

export function SiteTopBar({
  idPrefix,
  section,
  trailing,
  footer,
}: {
  idPrefix: string;
  section?: string;
  trailing?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-gray-alpha-400 bg-background-100">
      <div className={`mx-auto max-w-[1200px] ${CARD_PAD_X}`}>
        <div className="flex h-16 items-center gap-3">
          <Link href="/" className="flex h-11 shrink-0 items-center gap-2 text-gray-1000">
            <GridMark />
            <span className="text-heading-16">Grid</span>
          </Link>
          {section ? <p className="min-w-0 truncate text-label-13 text-gray-900">{section}</p> : null}
          <div className="hidden min-w-0 flex-1 md:block">
            <ConnectedSitePrimaryNav idPrefix={`${idPrefix}-desktop`} />
          </div>
          <div className="ml-auto hidden shrink-0 items-center gap-2 md:flex">
            <AssetSearchButton />
            {trailing}
          </div>
          {trailing ? <div className="ml-auto flex shrink-0 items-center gap-2 md:hidden">{trailing}</div> : null}
        </div>
        <div className="flex items-center gap-3 border-t border-gray-alpha-400 py-2 md:hidden">
          <AssetSearchButton />
          <ConnectedSitePrimaryNav idPrefix={`${idPrefix}-mobile`} />
        </div>
      </div>
      {footer}
      <AssetSearchDialogHost />
    </header>
  );
}
