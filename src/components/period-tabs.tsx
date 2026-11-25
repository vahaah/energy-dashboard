"use client";

import { PERIOD_OPTIONS } from "@/lib/dashboard-blocks";
import type { DashboardPeriod } from "@/lib/dashboard-period";
import { ChoiceRow } from "@/components/ui/choice-row";

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
    <ChoiceRow
      ariaLabel="Time period"
      variant="underline"
      value={period}
      pending={pending}
      onChange={onPeriodChange}
      onOptionIntent={onPeriodIntent}
      options={PERIOD_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
    />
  );
}
