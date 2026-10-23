"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
        <div className="flex min-h-16 items-center gap-3">
          <Link href="/" className="flex h-11 shrink-0 items-center gap-2 text-gray-1000">
            <GridMark />
            <span className="text-heading-16">Grid</span>
          </Link>
          {section ? <p className="min-w-0 truncate text-label-13 text-gray-900 md:hidden">{section}</p> : null}
          <div className="hidden min-w-0 flex-1 md:block">
            <ConnectedSitePrimaryNav idPrefix={`${idPrefix}-desktop`} />
          </div>
          <div className="ml-auto hidden shrink-0 items-center gap-2 md:flex">
            <AssetSearchButton />
            {trailing}
          </div>
          {trailing ? <div className="ml-auto flex shrink-0 items-center gap-2 md:hidden">{trailing}</div> : null}
        </div>
        <div className="flex min-w-0 items-center gap-3 border-t border-gray-alpha-400 py-2 md:hidden">
          <AssetSearchButton />
          <NavFadeScroll>
            <ConnectedSitePrimaryNav idPrefix={`${idPrefix}-mobile`} compact />
          </NavFadeScroll>
        </div>
      </div>
      {footer}
      <AssetSearchDialogHost />
    </header>
  );
}

function NavFadeScroll({ children }: { children: ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    const update = () => {
      const max = scroller.scrollWidth - scroller.clientWidth;
      setEdges({
        left: scroller.scrollLeft > 1,
        right: max - scroller.scrollLeft > 1,
      });
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    const child = scroller.firstElementChild;
    if (child) {
      observer.observe(child);
    }
    return () => {
      scroller.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="relative min-w-0 flex-1">
      <div
        ref={scrollerRef}
        className="overflow-x-auto overscroll-x-contain py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {edges.left ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-background-100 to-transparent"
        />
      ) : null}
      {edges.right ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background-100 to-transparent"
        />
      ) : null}
    </div>
  );
}
