"use client";

import type { ReactNode } from "react";

export function ResponsiveChartFrame({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return <div className={`${className} min-h-0 min-w-0`}>{children}</div>;
}
