import { Map, setWorkerUrl, type ExpressionSpecification } from "maplibre-gl";
import { documentTheme } from "@/lib/theme";
import { BASEMAP_GLYPHS, GB_FRAME_BOUNDS, MAP_CAMERA_MIN_ZOOM, MAP_MAX_BOUNDS } from "@/lib/map/constants";
import { POWER_CUTS_DNO_GEOJSON, shadeByLicenceArea } from "@/lib/power-cuts/dno-shade";
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

function cssColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value.length > 0 ? value : fallback;
}

function areaFill(
  incidents: readonly PowerCut[],
  quiet: string,
  planned: string,
  unplanned: string,
): string | ExpressionSpecification {
  const shades = shadeByLicenceArea(incidents);
  if (shades.size === 0) {
    return quiet;
  }
  const expression: unknown[] = ["match", ["get", "Area"]];
  for (const [name, shade] of shades) {
    expression.push(name, shade === "unplanned" ? unplanned : planned);
  }
  expression.push(quiet);
  return expression as ExpressionSpecification;
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
  const dark = documentTheme(document.documentElement) === "dark";
  const planned = cssColor("--chart-wind", dark ? "#0ea5e9" : "#0d94d2");
  const unplanned = cssColor("--chart-gas", dark ? "#f97316" : "#e06814");
  const quiet = dark ? "#3f3f46" : "#e4e4e7";
  const line = dark ? "#a1a1aa" : "#71717a";
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
        dno: { type: "geojson", data: POWER_CUTS_DNO_GEOJSON },
        cuts: { type: "geojson", data: features(incidents), cluster: false },
      },
      layers: [
        { id: "background", type: "background", paint: { "background-color": dark ? "#0a0a0a" : "#f4f4f5" } },
        {
          id: "dno-fill",
          type: "fill",
          source: "dno",
          paint: {
            "fill-color": areaFill(incidents, quiet, planned, unplanned),
            "fill-opacity": 0.72,
          },
        },
        {
          id: "dno-line",
          type: "line",
          source: "dno",
          paint: { "line-color": line, "line-width": 1.25 },
        },
        {
          id: "coast",
          type: "line",
          source: "coast",
          paint: { "line-color": dark ? "#3f3f46" : "#a1a1aa", "line-width": 1 },
        },
        {
          id: "cuts",
          type: "circle",
          source: "cuts",
          paint: {
            "circle-color": ["match", ["get", "kind"], "planned", planned, unplanned],
            "circle-radius": 5,
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
  return () => {
    map.remove();
  };
}
