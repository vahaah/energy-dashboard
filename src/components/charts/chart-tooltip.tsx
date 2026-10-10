"use client";

import type { ReactNode } from "react";

export function ChartTooltipCard({
  time,
  children,
}: {
  time: string;
  children: ReactNode;
}) {
  return (
    <div className="surface-card px-3 py-2 text-copy-14 text-gray-1000">
      <p className="mb-1 text-mono-12 text-gray-900">{time}</p>
      {children}
    </div>
  );
}

export function ChartTooltipRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <p className="flex items-center justify-between gap-6">
      <span className="inline-flex items-center gap-2">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        {label}
      </span>
      <span className="tabular-nums">{value}</span>
    </p>
  );
}
