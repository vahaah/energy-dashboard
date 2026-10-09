"use client";

import Link from "next/link";
import { CalendarDays, Check, Copy } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import type { TimeRange } from "@/lib/types";

const PERIODS = [
  { value: "24h", label: "Day", enabled: true },
  { value: "7d", label: "Week", enabled: true },
  { value: "1y", label: "Year", enabled: false },
  { value: "all", label: "All time", enabled: false },
] as const;

export function SiteHeader({
  range,
  onRangeChange,
  activeDate,
  minDate,
  maxDate,
  onDateChange,
  showDate,
  stamp,
  pending,
  copied,
  onShare,
}: {
  range: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  activeDate: string;
  minDate: string;
  maxDate: string;
  onDateChange: (date: string) => void;
  showDate: boolean;
  stamp: string;
  pending: boolean;
  copied: boolean;
  onShare: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-gray-alpha-400 bg-background-100">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-gray-1000">
          <span className="flex size-6 items-center justify-center rounded-md border border-gray-alpha-400 text-[11px] font-semibold">
            G
          </span>
          <span className="text-heading-16">Grid</span>
        </Link>

        <nav
          className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex"
          aria-label="Time period"
        >
          <PeriodTabs range={range} onRangeChange={onRangeChange} pending={pending} />
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {showDate ? (
            <label className="relative inline-flex h-8 min-h-11 min-w-11 items-center justify-center rounded-md border border-gray-alpha-400 bg-background-100 sm:min-h-8">
              <CalendarDays className="size-4 text-gray-1000" aria-hidden="true" />
              <span className="sr-only">Date</span>
              <input
                type="date"
                value={activeDate}
                min={minDate}
                max={maxDate}
                onChange={(event) => onDateChange(event.target.value || maxDate)}
                disabled={pending}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          ) : null}
          <button
            type="button"
            onClick={onShare}
            className="inline-flex h-8 min-h-11 items-center justify-center gap-2 rounded-md border border-gray-alpha-400 bg-background-100 px-3 text-label-13 text-gray-1000 sm:min-h-8"
          >
            {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            {copied ? "Copied" : "Share"}
          </button>
          <ThemeToggle />
        </div>
      </div>

      <div className="border-t border-gray-alpha-400 md:hidden">
        <div className="mx-auto flex h-10 max-w-[1200px] items-center overflow-x-auto px-4">
          <PeriodTabs range={range} onRangeChange={onRangeChange} pending={pending} />
        </div>
      </div>

      <p className="sr-only">{stamp}</p>
    </header>
  );
}

function PeriodTabs({
  range,
  onRangeChange,
  pending,
}: {
  range: TimeRange;
  onRangeChange: (next: TimeRange) => void;
  pending: boolean;
}) {
  return (
    <div className="flex items-center gap-4" role="tablist" aria-label="Day or week">
      {PERIODS.map((period) => {
        const selected = period.enabled && period.value === range;
        if (!period.enabled) {
          return (
            <span
              key={period.label}
              className="shrink-0 border-b-2 border-transparent pb-1 text-label-13 text-gray-700"
              title="Coming in a later update"
            >
              {period.label}
            </span>
          );
        }

        return (
          <button
            key={period.value}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={pending}
            onClick={() => onRangeChange(period.value)}
            className={`shrink-0 border-b-2 pb-1 text-label-13 ${
              selected
                ? "border-blue-700 text-gray-1000"
                : "border-transparent text-gray-900 hover:text-gray-1000"
            }`}
          >
            {period.label}
          </button>
        );
      })}
    </div>
  );
}
