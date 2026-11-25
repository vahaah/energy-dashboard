"use client";

import { CalendarDays, Check, Copy } from "lucide-react";
import { SiteTopBar } from "@/components/site-top-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { CARD_PAD_X } from "@/components/ui/card";
import { DataStateNotice } from "@/components/ui/data-state";
import { formatLondonDayMonthYear } from "@/lib/london-time";

export function SiteHeader({
  activeDate,
  minDate,
  maxDate,
  onDateChange,
  showDate,
  stamp,
  stale = false,
  copied,
  onShare,
  skipHref = "#section-overview",
}: {
  activeDate: string;
  minDate: string;
  maxDate: string;
  onDateChange: (date: string) => void;
  showDate: boolean;
  stamp: string;
  stale?: boolean;
  copied: boolean;
  onShare: () => void;
  skipHref?: string;
}) {
  return (
    <SiteTopBar
      idPrefix="dashboard"
      skipHref={skipHref}
      trailing={
        <>
          {showDate ? (
            <label className="relative inline-flex h-8 min-h-11 items-center gap-2 rounded-md border border-gray-alpha-400 bg-background-100 px-2 sm:min-h-8">
              <CalendarDays className="size-4 text-gray-1000" aria-hidden="true" />
              <span className="text-label-13 text-gray-1000">{formatLondonDayMonthYear(activeDate)}</span>
              <span className="sr-only">Date</span>
              <input
                type="date"
                name="date"
                autoComplete="off"
                value={activeDate}
                min={minDate}
                max={maxDate}
                onChange={(event) => onDateChange(event.target.value || maxDate)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          ) : null}
          <button
            type="button"
            onClick={onShare}
            aria-live="polite"
            aria-label={copied ? "Copied" : "Share"}
            className="inline-flex h-8 min-h-11 items-center justify-center gap-2 rounded-md border border-gray-alpha-400 bg-background-100 px-3 text-label-13 text-gray-1000 sm:min-h-8"
          >
            {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            {copied ? "Copied" : "Share"}
          </button>
          <ThemeToggle />
        </>
      }
      footer={
        <p
          className={
            stale
              ? `flex flex-wrap items-center justify-center gap-2 border-t border-gray-alpha-400 ${CARD_PAD_X} py-1.5 text-center text-label-12 text-gray-900`
              : "sr-only"
          }
          aria-live={stale ? "polite" : undefined}
        >
          {stale ? <DataStateNotice state="stale" /> : null}
          <span>{stamp}</span>
        </p>
      }
    />
  );
}
