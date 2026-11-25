"use client";

import { useSyncExternalStore, type ReactNode } from "react";

function subscribe(): () => void {
  return () => undefined;
}

export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

export function ResponsiveChartFrame({
  className,
  children,
  summary,
}: {
  className: string;
  children: ReactNode;
  summary: string;
}) {
  const isClient = useIsClient();
  return (
    <div className={`${className} w-full min-h-0 min-w-0 overflow-hidden`}>
      <p className="sr-only">{summary}</p>
      {isClient ? children : null}
    </div>
  );
}
