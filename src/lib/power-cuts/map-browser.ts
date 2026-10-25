import { Map, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import { BASEMAP_GLYPHS, GB_FRAME_BOUNDS, MAP_CAMERA_MIN_ZOOM, MAP_MAX_BOUNDS } from "@/lib/map/constants";
import type { PowerCut } from "@/lib/power-cuts/schema";

const WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

let workerReady = false;

function features(incidents: readonly PowerCut[]) {
  return {
    type: "FeatureCollection" as const,
    features: incidents.flatMap((incident) => {
      if (!incident.point) {
        return [];
      }
      return [
        {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [incident.point[0], incident.point[1]] as [number, number] },
          properties: { kind: incident.kind, id: incident.id },
        },
      ];
    }),
  };
}

function darkTheme(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function mountPowerCutsMap(
  container: HTMLElement,
  incidents: readonly PowerCut[],
  onStatus: (status: "ready" | "error") => void,
): () => void {
  if (!workerReady) {
    setWorkerUrl(WORKER_URL);
    workerReady = true;
  }
  const dark = darkTheme();
  const map = new Map({
    container,
    attributionControl: false,
    cooperativeGestures: true,
    fadeDuration: 0,
    center: [-2.2, 53.5],
    zoom: 5,
    minZoom: MAP_CAMERA_MIN_ZOOM,
    maxBounds: MAP_MAX_BOUNDS,
    style: {
      version: 8,
      glyphs: BASEMAP_GLYPHS,
      sources: {
        coast: { type: "geojson", data: "/basemap/coastline.geojson" },
        cuts: { type: "geojson", data: features(incidents), cluster: true, clusterRadius: 48, clusterMaxZoom: 11 },
      },
      layers: [
        { id: "background", type: "background", paint: { "background-color": dark ? "#0a0a0a" : "#f4f4f5" } },
        {
          id: "coast",
          type: "line",
          source: "coast",
          paint: { "line-color": dark ? "#3f3f46" : "#a1a1aa", "line-width": 1 },
        },
        {
          id: "clusters",
          type: "circle",
          source: "cuts",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": dark ? "#3f3f46" : "#d4d4d8",
            "circle-radius": ["step", ["get", "point_count"], 14, 10, 18, 30, 24],
            "circle-stroke-width": 1,
            "circle-stroke-color": dark ? "#a1a1aa" : "#3f3f46",
          },
        },
        {
          id: "cuts",
          type: "circle",
          source: "cuts",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": ["match", ["get", "kind"], "planned", "#0d94d2", "#f97316"],
            "circle-radius": 6,
            "circle-stroke-width": 1,
            "circle-stroke-color": dark ? "#0a0a0a" : "#ffffff",
          },
        },
      ],
    },
  });
  map.on("error", () => {
    onStatus("error");
  });
  map.on("load", () => {
    map.fitBounds(
      [
        [GB_FRAME_BOUNDS.west, GB_FRAME_BOUNDS.south],
        [GB_FRAME_BOUNDS.east, GB_FRAME_BOUNDS.north],
      ],
      { padding: 24, animate: false },
    );
    onStatus("ready");
  });
  map.on("click", "clusters", (event) => {
    const feature = event.features?.[0];
    const clusterId = feature?.properties?.cluster_id;
    const source = map.getSource("cuts");
    if (typeof clusterId !== "number" || !source || !("getClusterExpansionZoom" in source)) {
      return;
    }
    (source as GeoJSONSource).getClusterExpansionZoom(clusterId).then((zoom) => {
      const geometry = feature?.geometry;
      if (geometry?.type !== "Point") {
        return;
      }
      map.easeTo({ center: geometry.coordinates as [number, number], zoom });
    }).catch(() => {
      onStatus("error");
    });
  });
  return () => {
    map.remove();
  };
}
