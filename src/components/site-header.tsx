"use client";

import Link from "next/link";
import { CalendarDays, Check, Copy } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import type { DashboardPeriod } from "@/lib/dashboard-period";
import { formatLondonDayMonthYear } from "@/lib/london-time";

const PERIODS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "year", label: "Year" },
  { value: "all", label: "All time" },
] as const;

export function SiteHeader({
  period,
  onPeriodChange,
  onPeriodIntent,
  activeDate,
  minDate,
  maxDate,
  onDateChange,
  showDate,
  stamp,
  stale = false,
  pending,
  copied,
  onShare,
}: {
  period: DashboardPeriod | null;
  onPeriodChange: (period: DashboardPeriod) => void;
  onPeriodIntent?: (period: DashboardPeriod) => void;
  activeDate: string;
  minDate: string;
  maxDate: string;
  onDateChange: (date: string) => void;
  showDate: boolean;
  stamp: string;
  stale?: boolean;
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
          <PeriodTabs
            period={period}
            onPeriodChange={onPeriodChange}
            onPeriodIntent={onPeriodIntent}
            pending={pending}
          />
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {showDate ? (
            <label className="relative inline-flex h-8 min-h-11 items-center gap-2 rounded-md border border-gray-alpha-400 bg-background-100 px-2 sm:min-h-8">
              <CalendarDays className="size-4 text-gray-1000" aria-hidden="true" />
              <span className="text-label-13 text-gray-1000">{formatLondonDayMonthYear(activeDate)}</span>
              <span className="sr-only">Date</span>
              <input
                type="date"
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
          <PeriodTabs
            period={period}
            onPeriodChange={onPeriodChange}
            onPeriodIntent={onPeriodIntent}
            pending={pending}
          />
        </div>
      </div>

      <p
        className={
          stale
            ? "border-t border-gray-alpha-400 px-4 py-1.5 text-center text-label-12 text-gray-900"
            : "sr-only"
        }
        aria-live={stale ? "polite" : undefined}
      >
        {stamp}
      </p>
    </header>
  );
}

function PeriodTabs({
  period,
  onPeriodChange,
  onPeriodIntent,
  pending,
}: {
  period: DashboardPeriod | null;
  onPeriodChange: (next: DashboardPeriod) => void;
  onPeriodIntent?: (next: DashboardPeriod) => void;
  pending: boolean;
}) {
  return (
    <div className={`flex items-center gap-4 ${pending ? "opacity-70" : ""}`} role="tablist" aria-label="Time period">
      {PERIODS.map((item) => {
        const selected = item.value === period;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onMouseEnter={() => onPeriodIntent?.(item.value)}
            onFocus={() => onPeriodIntent?.(item.value)}
            onClick={() => onPeriodChange(item.value)}
            className={`shrink-0 border-b-2 pb-1 text-label-13 ${
              selected
                ? "border-blue-700 text-gray-1000"
                : "border-transparent text-gray-900 hover:text-gray-1000"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
