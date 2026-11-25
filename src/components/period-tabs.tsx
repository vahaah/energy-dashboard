"use client";

import { PERIOD_OPTIONS } from "@/lib/dashboard-blocks";
import type { DashboardPeriod } from "@/lib/dashboard-period";

export function PeriodTabs({
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
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${pending ? "opacity-70" : ""}`}
      role="group"
      aria-label="Time period"
    >
      {PERIOD_OPTIONS.map((item) => {
        const selected = item.value === period;
        return (
          <button
            key={item.value}
            type="button"
            aria-current={selected ? "page" : undefined}
            onMouseEnter={() => onPeriodIntent?.(item.value)}
            onFocus={() => onPeriodIntent?.(item.value)}
            onClick={() => onPeriodChange(item.value)}
            className={`inline-flex min-h-11 shrink-0 items-center border-b-2 px-0.5 text-label-13 focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:outline-none sm:min-h-8 ${
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
