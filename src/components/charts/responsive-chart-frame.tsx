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
}: {
  className: string;
  children: ReactNode;
}) {
  const isClient = useIsClient();
  return (
    <div className={`${className} w-full min-h-0 min-w-0 overflow-hidden`}>
      {isClient ? children : null}
    </div>
  );
}
