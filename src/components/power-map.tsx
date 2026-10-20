"use client";

import { useEffect, useRef, useState } from "react";
import type { MapPoint } from "@/lib/assets/types";
import type { MapBounds } from "@/lib/map/counts";
import type { MapTheme, PowerMapHandle } from "@/lib/map/browser";
import type { InterconnectorLine } from "@/lib/map/interconnector-layer";

/**
 * maplibre-gl and pmtiles load through this dynamic import so the homepage
 * module graph never includes them. The library stays in the map chunk.
 */
export function PowerMap({
  points,
  lines,
  dnoPath,
  dnoVisible,
  assetsVisible,
  linesVisible,
  selectedId,
  onSelect,
  onView,
  className = "h-[28rem]",
}: {
  points: readonly MapPoint[];
  lines: readonly InterconnectorLine[];
  dnoPath: string;
  dnoVisible: boolean;
  assetsVisible: boolean;
  linesVisible: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onView: (bounds: MapBounds) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const handle = useRef<PowerMapHandle | null>(null);
  const pointsRef = useRef(points);
  const linesRef = useRef(lines);
  const dnoVisibleRef = useRef(dnoVisible);
  const assetsVisibleRef = useRef(assetsVisible);
  const linesVisibleRef = useRef(linesVisible);
  const selectedRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const onViewRef = useRef(onView);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  pointsRef.current = points;
  linesRef.current = lines;
  dnoVisibleRef.current = dnoVisible;
  assetsVisibleRef.current = assetsVisible;
  linesVisibleRef.current = linesVisible;
  selectedRef.current = selectedId;
  onSelectRef.current = onSelect;
  onViewRef.current = onView;

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    let disposed = false;
    void Promise.all([import("@/app/map/maplibre.css"), import("@/lib/map/browser")])
      .then(([, mod]) => {
        if (disposed || !ref.current) {
          return;
        }
        handle.current = mod.mountPowerMap(ref.current, {
          points: pointsRef.current,
          lines: linesRef.current,
          dnoPath,
          dnoVisible: dnoVisibleRef.current,
          assetsVisible: assetsVisibleRef.current,
          linesVisible: linesVisibleRef.current,
          selectedId: selectedRef.current,
          onStatus: (next) => {
            if (!disposed) {
              setStatus(next);
            }
          },
          onSelect: (id) => {
            onSelectRef.current(id);
          },
          onView: (bounds) => {
            onViewRef.current(bounds);
          },
        });
      })
      .catch(() => {
        if (!disposed) {
          setStatus("error");
        }
      });
    return () => {
      disposed = true;
      handle.current?.destroy();
      handle.current = null;
    };
  }, [dnoPath]);

  useEffect(() => {
    handle.current?.setDnoVisible(dnoVisible);
  }, [dnoVisible]);

  useEffect(() => {
    handle.current?.setAssetsVisible(assetsVisible);
  }, [assetsVisible]);

  useEffect(() => {
    handle.current?.setLinesVisible(linesVisible);
  }, [linesVisible]);

  useEffect(() => {
    handle.current?.setPoints(points);
  }, [points]);

  useEffect(() => {
    handle.current?.setLines(lines);
  }, [lines]);

  useEffect(() => {
    handle.current?.setSelected(selectedId);
  }, [selectedId]);

  useEffect(() => {
    const root = document.documentElement;
    const read = (): MapTheme => (root.classList.contains("dark") ? "dark" : "light");
    const observer = new MutationObserver(() => {
      handle.current?.setTheme(read());
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-w-0">
      <div className={`power-map relative w-full min-w-0 overflow-hidden rounded-lg bg-background-200 ${className}`}>
        <div ref={ref} data-map-status={status} className="h-full w-full" />
      </div>
      {status === "error" ? (
        <p className="pt-3 text-copy-14 text-gray-900" role="status">
          Basemap tiles did not load. The asset list is still available.
        </p>
      ) : (
        <p className="sr-only" role="status">
          {status === "ready" ? "Map ready." : "Map loading."}
        </p>
      )}
    </div>
  );
}
