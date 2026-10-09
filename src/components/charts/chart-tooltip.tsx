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
    <div className="rounded-xl border border-gray-alpha-400 bg-background-100 px-3 py-2 text-copy-14 text-gray-1000">
      <p className="mb-1 text-mono-12 text-gray-900">{time}</p>
      {children}
    </div>
  );
}
