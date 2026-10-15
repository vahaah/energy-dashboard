"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MapPoint } from "@/lib/assets/types";
import type { MapTheme, PowerMapHandle } from "@/lib/map/browser";

/**
 * maplibre-gl and pmtiles load through this dynamic import so the homepage
 * module graph never includes them. The library stays in the map chunk.
 */
export function PowerMap({
  points,
  dnoPath,
  dnoVisible,
  assetsVisible,
  selectedId,
  className = "h-[28rem]",
}: {
  points: readonly MapPoint[];
  dnoPath: string;
  dnoVisible: boolean;
  assetsVisible: boolean;
  selectedId: string | null;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const handle = useRef<PowerMapHandle | null>(null);
  const pointsRef = useRef(points);
  const dnoVisibleRef = useRef(dnoVisible);
  const assetsVisibleRef = useRef(assetsVisible);
  const selectedRef = useRef(selectedId);
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  pointsRef.current = points;
  dnoVisibleRef.current = dnoVisible;
  assetsVisibleRef.current = assetsVisible;
  selectedRef.current = selectedId;

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    let disposed = false;
    void import("@/lib/map/browser")
      .then((mod) => {
        if (disposed || !ref.current) {
          return;
        }
        const fromUrl = new URLSearchParams(window.location.search).get("asset");
        handle.current = mod.mountPowerMap(ref.current, {
          points: pointsRef.current,
          dnoPath,
          dnoVisible: dnoVisibleRef.current,
          assetsVisible: assetsVisibleRef.current,
          selectedId: selectedRef.current ?? fromUrl,
          onStatus: (next) => {
            if (!disposed) {
              setStatus(next);
            }
          },
          onSelect: (id) => {
            router.push(`/assets/${id}`);
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
  }, [dnoPath, router]);

  useEffect(() => {
    handle.current?.setDnoVisible(dnoVisible);
  }, [dnoVisible]);

  useEffect(() => {
    handle.current?.setAssetsVisible(assetsVisible);
  }, [assetsVisible]);

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
      <div
        ref={ref}
        data-map-status={status}
        className={`power-map w-full min-w-0 overflow-hidden rounded-lg bg-background-200 ${className}`}
      />
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
