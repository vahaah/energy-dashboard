"use client";

import { useEffect, useState } from "react";

export function ResponsiveChartFrame({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setReady(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return <div className={`${className} min-h-0 min-w-0`}>{ready ? children : null}</div>;
}
