"use client";

import { useEffect, useRef, useState } from "react";
import type { PowerCut } from "@/lib/power-cuts/schema";

type MapStatus = "loading" | "ready" | "error";

/** MapLibre loads in the browser. The static module graph does not include it. */
export function PowerCutsMap({ incidents }: { incidents: readonly PowerCut[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<MapStatus>("loading");

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    let disposed = false;
    let destroy: (() => void) | null = null;
    void Promise.all([import("@/app/map/maplibre.css"), import("@/lib/power-cuts/map-browser")])
      .then(([, mod]) => {
        if (disposed || !ref.current) {
          return;
        }
        try {
          destroy = mod.mountPowerCutsMap(ref.current, incidents, (next) => {
            if (!disposed) {
              setStatus(next);
            }
          });
        } catch {
          if (!disposed) {
            setStatus("error");
          }
        }
      })
      .catch(() => {
        if (!disposed) {
          setStatus("error");
        }
      });
    return () => {
      disposed = true;
      destroy?.();
    };
  }, [incidents]);

  return (
    <div className="relative h-80 min-w-0 overflow-hidden rounded-xl border border-gray-alpha-400 sm:h-[28rem]" data-power-cuts-map={status}>
      <div ref={ref} className="h-full w-full" />
      {status === "error" ? (
        <p className="absolute inset-0 flex items-center justify-center bg-background-100 px-4 text-center text-copy-14 text-gray-900">
          The map could not be drawn. The list below has the same incidents.
        </p>
      ) : null}
    </div>
  );
}
