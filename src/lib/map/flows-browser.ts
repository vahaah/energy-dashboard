import { addProtocol, GeoJSONSource, Map, NavigationControl, setWorkerUrl } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { transformBasemapStyle as transformStyle } from "@/lib/map/absolute-style";
import { themeColor } from "@/lib/map/basemap-style";
import { CHEVRON_STEPS, chevronDash } from "@/lib/map/chevron-dash";
import {
  BASEMAP_DETAIL_MIN_ZOOM,
  GB_FRAME_BOUNDS,
  MAP_CAMERA_MIN_ZOOM,
  MAP_MAX_BOUNDS,
  clampOverviewBounds,
  clampToMapBounds,
} from "@/lib/map/constants";
import { CHEVRON_CYCLE_MS, ELECTRICITY_DIRECTION, GAS_DIRECTION } from "@/lib/map/flow-scale";
import { FLOWS_KEYBOARD, FLOWS_TITLE } from "@/lib/map/flows-copy";
import { MAP_SIZE_STEPS, type MarkerShape } from "@/lib/map/marker";
import { basemapStartupFailed } from "@/lib/map/startup-error";
import type { StationFeatureCollection } from "@/lib/map/stations-layer";
import { TODAY_GROUPS } from "@/lib/map/today-figures";

export type FlowsMapTheme = "light" | "dark";
export type FlowsMapStatus = "ready" | "error";

export type FlowDrawLine = {
  id: string;
  name: string;
  kind: "interconnector" | "gas_terminal";
  width: number | null;
  /** Positive electricity is an import to GB. Positive gas is into the system. */
  value: number | null;
  direction: string | null;
  stale: boolean;
  gb: [number, number];
  remote: [number, number] | null;
};

const WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";
const HIT_RADIUS = 24;
const HIT_LINE = 16;
const LABEL_LAYERS = ["names-overview", "names-country", "names-city", "names-town"] as const;
const FLOW_LINE_LAYERS = ["flow-quiet", "flow-fresh"] as const;
const FLOW_MARKER_LAYERS = ["flow-dots"] as const;

export type GridMapTestHook = {
  labelCount: () => number;
  flowCount: () => number;
  flowLineCount: () => number;
  flowMarkerCount: () => number;
  project: (longitude: number, latitude: number) => { x: number; y: number } | null;
  /** Place-name layers sit above the station symbol layer. */
  labelsAboveStations: () => boolean;
  /** Station centres in CSS pixels, for sampling the land between markers. */
  stationDots: () => { x: number; y: number; radius: number }[];
};

let protocolReady = false;

function ensureProtocol(): void {
  if (protocolReady) {
    return;
  }
  setWorkerUrl(WORKER_URL);
  const protocol = new Protocol();
  addProtocol("pmtiles", protocol.tile);
  protocolReady = true;
}

function themeOf(): FlowsMapTheme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function styleUrl(theme: FlowsMapTheme): string {
  return theme === "dark" ? "/basemap/style-dark.json" : "/basemap/style-light.json";
}

function cssColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value.length > 0 ? value : fallback;
}

type LineFeature = {
  type: "Feature";
  geometry: { type: "LineString"; coordinates: [number, number][] };
  properties: {
    id: string;
    name: string;
    kind: string;
    width: number;
    bucket: "fresh" | "quiet";
    color: string;
  };
};

type PointFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: { id: string; name: string; kind: string };
};

function offshore(point: [number, number]): [number, number] {
  const dx = point[0] + 2;
  const dy = point[1] - 54;
  const length = Math.hypot(dx, dy) || 1;
  return [point[0] + (dx / length) * 0.45, point[1] + (dy / length) * 0.45];
}

function lineFeatures(
  lines: readonly FlowDrawLine[],
  imports: string,
  gas: string,
  amber: string,
  quiet: string,
): LineFeature[] {
  const features: LineFeature[] = [];
  for (const line of lines) {
    const start = line.remote ?? offshore(line.gb);
    const towardTerminal = line.direction === ELECTRICITY_DIRECTION.import || line.direction === GAS_DIRECTION.into;
    const coordinates: [number, number][] = towardTerminal ? [start, line.gb] : [line.gb, start];
    const fresh = line.direction !== null && !line.stale && line.width !== null;
    const color = line.stale ? amber : line.kind === "gas_terminal" ? gas : line.direction ? imports : quiet;
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates },
      properties: {
        id: line.id,
        name: line.name,
        kind: line.kind,
        width: line.width ?? 1,
        bucket: fresh ? "fresh" : "quiet",
        color,
      },
    });
  }
  return features;
}

function pointFeatures(lines: readonly FlowDrawLine[]): PointFeature[] {
  return lines.map((line) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: line.gb },
    properties: { id: line.id, name: line.name, kind: line.kind },
  }));
}

const MARKER_HALO_PX = 1.35;

function traceShape(context: CanvasRenderingContext2D, shape: MarkerShape, radius: number): void {
  context.beginPath();
  switch (shape) {
    case "circle":
    case "ring":
      context.arc(0, 0, radius, 0, Math.PI * 2);
      break;
    case "diamond":
      context.moveTo(0, -radius);
      context.lineTo(radius, 0);
      context.lineTo(0, radius);
      context.lineTo(-radius, 0);
      context.closePath();
      break;
    case "square":
      context.rect(-radius * 0.78, -radius * 0.78, radius * 1.56, radius * 1.56);
      break;
    case "triangle":
      context.moveTo(0, -radius);
      context.lineTo(radius * 0.92, radius * 0.78);
      context.lineTo(-radius * 0.92, radius * 0.78);
      context.closePath();
      break;
    case "triangle-down":
      context.moveTo(0, radius);
      context.lineTo(radius * 0.92, -radius * 0.78);
      context.lineTo(-radius * 0.92, -radius * 0.78);
      context.closePath();
      break;
    case "hexagon":
      for (let index = 0; index < 6; index += 1) {
        const angle = (Math.PI / 3) * index - Math.PI / 2;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (index === 0) {
          context.moveTo(px, py);
        } else {
          context.lineTo(px, py);
        }
      }
      context.closePath();
      break;
    case "plus":
      context.rect(-radius * 0.32, -radius, radius * 0.64, radius * 2);
      context.rect(-radius, -radius * 0.32, radius * 2, radius * 0.64);
      break;
    default: {
      const neverShape: never = shape;
      void neverShape;
      break;
    }
  }
}

/**
 * Filled technology shape. The halo is the basemap land colour for the theme,
 * so the anti-aliased edge reads as land instead of a dark fringe. On a light
 * map a dark fringe from hundreds of markers piles up into grey patches.
 */
function drawShape(
  context: CanvasRenderingContext2D,
  shape: MarkerShape,
  x: number,
  y: number,
  radius: number,
  color: string,
  halo: string,
): void {
  context.save();
  context.translate(x, y);
  context.lineJoin = "round";
  context.lineCap = "round";
  if (shape !== "ring") {
    traceShape(context, shape, radius + MARKER_HALO_PX);
    context.fillStyle = halo;
    context.fill();
  }
  traceShape(context, shape, radius);
  if (shape === "ring") {
    context.strokeStyle = halo;
    context.lineWidth = 1.5 + MARKER_HALO_PX * 2;
    context.stroke();
    context.strokeStyle = color;
    context.lineWidth = 1.5;
    context.stroke();
  } else {
    context.fillStyle = color;
    context.fill();
  }
  context.restore();
}

function markerPixelRatio(): number {
  return Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
}

function markerIconId(theme: FlowsMapTheme, shape: string, radius: number, color: string): string {
  return `station-${theme}-${shape}-${radius}-${color.replace("#", "")}`;
}

function rasterizeMarker(shape: MarkerShape, radius: number, color: string, halo: string, ratio: number): ImageData {
  const pad = MARKER_HALO_PX + 1;
  const css = Math.ceil((radius + pad) * 2);
  const size = Math.max(1, Math.ceil(css * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) {
    throw new Error("station marker image");
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawShape(context, shape, css / 2, css / 2, radius, color, halo);
  return context.getImageData(0, 0, size, size);
}

export type FlowsMapHandle = {
  destroy: () => void;
  setLines: (lines: readonly FlowDrawLine[]) => void;
  setVisibility: (visibility: { electricity: boolean; gas: boolean; dno: boolean; stations: boolean }) => void;
  setSelected: (id: string | null) => void;
  setStations: (collection: StationFeatureCollection) => void;
  setTheme: (theme: FlowsMapTheme) => void;
};

export function mountFlowsMap(
  container: HTMLElement,
  options: {
    lines: readonly FlowDrawLine[];
    dnoPath: string;
    electricity: boolean;
    gas: boolean;
    dno: boolean;
    stations: boolean;
    selectedId: string | null;
    onStatus: (status: FlowsMapStatus) => void;
    onSelect: (id: string) => void;
  },
): FlowsMapHandle {
  ensureProtocol();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let theme = themeOf();
  let lines = options.lines.slice();
  let electricity = options.electricity;
  let gas = options.gas;
  let dno = options.dno;
  let stationsOn = options.stations;
  let stations: StationFeatureCollection = {
    type: "FeatureCollection",
    features: [],
  };
  let pointersBound = false;
  let ready = false;
  let styleLoaded = false;
  let basemapLoaded = false;
  let frame = 0;
  let dashStep = -1;
  let hidden = document.visibilityState === "hidden";

  // MapLibre 6.14 only applies transformStyle inside setStyle. MapOptions
  // has no such field, and the constructor's setStyle drops it.
  const map = new Map({
    container,
    attributionControl: false,
    keyboard: false,
    cooperativeGestures: false,
    fadeDuration: reduceMotion ? 0 : 300,
    center: [-2.2, 54.2],
    zoom: BASEMAP_DETAIL_MIN_ZOOM,
    minZoom: MAP_CAMERA_MIN_ZOOM,
    maxBounds: MAP_MAX_BOUNDS,
  });
  map.addControl(new NavigationControl({ showCompass: false, visualizePitch: false }), "top-right");
  const canvas = map.getCanvas();
  canvas.setAttribute("role", "application");
  canvas.setAttribute("aria-label", `${FLOWS_TITLE}. ${FLOWS_KEYBOARD}`);

  function colors() {
    return {
      imports: cssColor("--chart-imports", "#64748b"),
      gas: cssColor("--chart-gas", "#e06814"),
      amber: cssColor("--amber-700", "#d97706"),
      quiet: cssColor("--gray-700", "#737373"),
    };
  }

  function visible(kind: string): boolean {
    if (kind === "gas_terminal") {
      return gas;
    }
    return electricity;
  }

  function collection() {
    const palette = colors();
    const shown = lines.filter((line) => visible(line.kind));
    return {
      lines: {
        type: "FeatureCollection" as const,
        features: lineFeatures(shown, palette.imports, palette.gas, palette.amber, palette.quiet),
      },
      points: {
        type: "FeatureCollection" as const,
        features: pointFeatures(shown),
      },
    };
  }

  function paintLines(): void {
    const data = collection();
    const lineSource = map.getSource("flows");
    const pointSource = map.getSource("flow-points");
    if (lineSource instanceof GeoJSONSource) {
      lineSource.setData(data.lines);
    }
    if (pointSource instanceof GeoJSONSource) {
      pointSource.setData(data.points);
    }
  }

  function addFlowLayers(): void {
    const data = collection();
    if (!map.getSource("flows")) {
      map.addSource("flows", { type: "geojson", data: data.lines });
      map.addSource("flow-points", { type: "geojson", data: data.points });
      map.addSource("flow-hover", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "flow-quiet",
        type: "line",
        source: "flows",
        filter: ["==", ["get", "bucket"], "quiet"],
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["get", "width"],
        },
      });
      map.addLayer({
        id: "flow-fresh",
        type: "line",
        source: "flows",
        filter: ["==", ["get", "bucket"], "fresh"],
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["get", "width"],
          "line-dasharray": [2, 2],
        },
      });
      map.addLayer({
        id: "flow-hit",
        type: "line",
        source: "flows",
        paint: {
          "line-color": "#000000",
          "line-width": HIT_LINE,
          "line-opacity": 0.01,
        },
      });
      map.addLayer({
        id: "flow-marker-hit",
        type: "circle",
        source: "flow-points",
        paint: {
          "circle-radius": HIT_RADIUS,
          "circle-color": "#000000",
          "circle-opacity": 0.01,
        },
      });
      map.addLayer({
        id: "flow-dots",
        type: "circle",
        source: "flow-points",
        paint: {
          "circle-radius": 5,
          "circle-color": theme === "dark" ? "#fafafa" : "#171717",
          "circle-stroke-width": 2,
          "circle-stroke-color": cssColor("--chart-imports", "#64748b"),
        },
      });
      map.addLayer({
        id: "flow-hover-label",
        type: "symbol",
        source: "flow-hover",
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Geist Sans Regular"],
          "text-size": 12,
          "text-offset": [0, -1.4],
          "text-anchor": "bottom",
        },
        paint: {
          "text-color": theme === "dark" ? "#fafafa" : "#171717",
          "text-halo-color": theme === "dark" ? "#0a0a0a" : "#ffffff",
          "text-halo-width": 1,
        },
      });
    } else {
      paintLines();
    }
  }

  function bindPointers(): void {
    const hover = (id: string | undefined, name: string | undefined, coordinates: [number, number] | null) => {
      map.getCanvas().style.cursor = id ? "pointer" : "";
      const source = map.getSource("flow-hover");
      if (!(source instanceof GeoJSONSource) || !coordinates || !id || !name) {
        if (source instanceof GeoJSONSource) {
          source.setData({ type: "FeatureCollection", features: [] });
        }
        return;
      }
      source.setData({
        type: "Feature",
        geometry: { type: "Point", coordinates },
        properties: { id, name },
      });
    };
    for (const layer of ["flow-hit", "flow-marker-hit"] as const) {
      map.on("click", layer, (event) => {
        const id = event.features?.[0]?.properties.id;
        if (typeof id === "string") {
          options.onSelect(id);
        }
      });
      map.on("mouseenter", layer, (event) => {
        const feature = event.features?.[0];
        const id = feature?.properties.id;
        const name = feature?.properties.name;
        const geometry = feature?.geometry;
        const coordinates = geometry && geometry.type === "Point" ? (geometry.coordinates as [number, number]) : null;
        const midpoint =
          geometry && geometry.type === "LineString" ? (geometry.coordinates[0] as [number, number]) : coordinates;
        hover(typeof id === "string" ? id : undefined, typeof name === "string" ? name : undefined, midpoint);
      });
      map.on("mouseleave", layer, () => hover(undefined, undefined, null));
    }
    map.on("click", "station-hit", (event) => {
      const id = event.features?.[0]?.properties.id;
      if (typeof id === "string") {
        options.onSelect(id);
      }
    });
    map.on("mouseenter", "station-hit", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "station-hit", () => {
      map.getCanvas().style.cursor = "";
    });
  }

  function stationVisibility(): "visible" | "none" {
    return stationsOn ? "visible" : "none";
  }

  function beforeLabels(): string | undefined {
    return map.getLayer("names-overview") ? "names-overview" : undefined;
  }

  function ensureMarkerImages(): void {
    const halo = themeColor(theme, "land");
    const ratio = markerPixelRatio();
    for (const group of TODAY_GROUPS) {
      for (const step of MAP_SIZE_STEPS) {
        const id = markerIconId(theme, group.shape, step.radius, group.color);
        if (map.hasImage(id)) {
          continue;
        }
        map.addImage(id, rasterizeMarker(group.shape, step.radius, group.color, halo, ratio), {
          pixelRatio: ratio,
        });
      }
    }
  }

  function addStationLayers(): void {
    ensureMarkerImages();
    const land = themeColor(theme, "land");
    if (!map.getSource("stations")) {
      map.addSource("stations", { type: "geojson", data: stations });
      // Under the place names. A land-coloured hit disc stays invisible when
      // the discs stack; a black disc at the same opacity greys the land.
      map.addLayer(
        {
          id: "station-markers",
          type: "symbol",
          source: "stations",
          layout: {
            visibility: stationVisibility(),
            "icon-image": [
              "concat",
              `station-${theme}-`,
              ["get", "shape"],
              "-",
              ["to-string", ["get", "radius"]],
              "-",
              ["slice", ["get", "color"], 1],
            ],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-padding": 0,
            "symbol-sort-key": ["*", ["get", "radius"], -1],
          },
        },
        beforeLabels(),
      );
      map.addLayer(
        {
          id: "station-hit",
          type: "circle",
          source: "stations",
          layout: { visibility: stationVisibility() },
          paint: {
            "circle-radius": HIT_RADIUS,
            "circle-color": land,
            "circle-opacity": 0.01,
            "circle-stroke-width": 0,
            "circle-blur": 0,
          },
        },
        beforeLabels(),
      );
      return;
    }
    const source = map.getSource("stations");
    if (source instanceof GeoJSONSource) {
      source.setData(stations);
    }
    for (const id of ["station-markers", "station-hit"] as const) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, "visibility", stationVisibility());
      }
    }
    if (map.getLayer("station-hit")) {
      map.setPaintProperty("station-hit", "circle-color", land);
    }
  }

  function addDno(): void {
    if (!dno) {
      if (map.getLayer("dno-line")) {
        map.setLayoutProperty("dno-fill", "visibility", "none");
        map.setLayoutProperty("dno-line", "visibility", "none");
      }
      return;
    }
    if (!map.getSource("dno")) {
      map.addSource("dno", { type: "geojson", data: options.dnoPath });
      map.addLayer(
        {
          id: "dno-fill",
          type: "fill",
          source: "dno",
          paint: { "fill-color": "#3291ff", "fill-opacity": 0.12 },
        },
        map.getLayer("flow-quiet") ? "flow-quiet" : undefined,
      );
      map.addLayer(
        {
          id: "dno-line",
          type: "line",
          source: "dno",
          paint: { "line-color": "#3291ff", "line-width": 1 },
        },
        map.getLayer("flow-quiet") ? "flow-quiet" : undefined,
      );
    }
    map.setLayoutProperty("dno-fill", "visibility", "visible");
    map.setLayoutProperty("dno-line", "visibility", "visible");
  }

  function sheetOverlap(): number {
    const sheet = document.querySelector("[data-flow-sheet]");
    if (!(sheet instanceof HTMLElement)) {
      return 0;
    }
    const sheetRect = sheet.getBoundingClientRect();
    const mapRect = container.getBoundingClientRect();
    if (sheetRect.width <= 0 || sheetRect.height <= 0) {
      return 0;
    }
    const overlap = Math.min(mapRect.bottom, sheetRect.bottom) - Math.max(mapRect.top, sheetRect.top);
    return overlap > 0 ? overlap : 0;
  }

  function overviewPadding(): {
    top: number;
    right: number;
    bottom: number;
    left: number;
  } {
    const width = container.clientWidth;
    const height = container.clientHeight;
    // Below lg the sheet sits on the map. The frame inset keeps the canvas
    // above it; any part that still covers the canvas is added here so Great
    // Britain is not fitted underneath the sheet.
    if (window.innerWidth < 1024) {
      return {
        top: 28,
        right: 28,
        bottom: Math.round(sheetOverlap()) + 16,
        left: 16,
      };
    }
    const side = Math.round(Math.min(width, height) * 0.06);
    return { top: side, right: side + 8, bottom: side, left: side };
  }

  function frameView(): void {
    if (container.clientWidth < 2 || container.clientHeight < 2) {
      return;
    }
    let west = GB_FRAME_BOUNDS.west;
    let east = GB_FRAME_BOUNDS.east;
    let south = GB_FRAME_BOUNDS.south;
    let north = GB_FRAME_BOUNDS.north;
    for (const line of lines) {
      const points = [line.gb, line.remote].filter((point): point is [number, number] => point !== null);
      for (const point of points) {
        west = Math.min(west, point[0]);
        east = Math.max(east, point[0]);
        south = Math.min(south, point[1]);
        north = Math.max(north, point[1]);
      }
    }
    const camera = clampOverviewBounds({ west, south, east, north });
    map.fitBounds(
      [
        [camera.west, camera.south],
        [camera.east, camera.north],
      ],
      { padding: overviewPadding(), maxZoom: 6.5, animate: false },
    );
  }

  function tick(): void {
    frame = 0;
    if (!ready || reduceMotion || hidden || !map.getLayer("flow-fresh")) {
      return;
    }
    const phase = (performance.now() % CHEVRON_CYCLE_MS) / CHEVRON_CYCLE_MS;
    const step = Math.floor(phase * CHEVRON_STEPS) % CHEVRON_STEPS;
    if (step !== dashStep) {
      dashStep = step;
      map.setPaintProperty("flow-fresh", "line-dasharray", chevronDash(step));
    }
    frame = window.requestAnimationFrame(tick);
  }

  function startMotion(): void {
    if (frame || reduceMotion || hidden) {
      return;
    }
    frame = window.requestAnimationFrame(tick);
  }

  function stopMotion(): void {
    if (frame) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }
    dashStep = -1;
    if (map.getLayer("flow-fresh")) {
      map.setPaintProperty("flow-fresh", "line-dasharray", [2, 2]);
    }
  }

  function renderedCount(layers: readonly string[]): number {
    const present = layers.filter((id) => map.getLayer(id));
    if (present.length === 0) {
      return 0;
    }
    return map.queryRenderedFeatures({ layers: present }).length;
  }

  function paint(): void {
    addFlowLayers();
    addStationLayers();
    addDno();
    if (!pointersBound) {
      bindPointers();
      pointersBound = true;
    }
    if (!ready) {
      map.resize();
      frameView();
      ready = true;
      options.onStatus("ready");
      startMotion();
    }
  }

  map.on("style.load", () => {
    styleLoaded = true;
    paint();
  });
  map.on("resize", () => {
    frameView();
  });
  map.on("sourcedata", (event) => {
    if (event.sourceId !== "zoomstack" || !map.getSource("zoomstack") || !map.isSourceLoaded("zoomstack")) {
      return;
    }
    basemapLoaded = true;
  });
  map.on("error", (ev) => {
    if (process.env.NODE_ENV === "development") {
      console.error(ev.error);
    }
    if (basemapStartupFailed(ev, styleLoaded, basemapLoaded)) {
      options.onStatus("error");
    }
  });
  const tested = container as HTMLElement & {
    maplibreMap?: Map;
    __gridMapTest?: GridMapTestHook;
  };
  const testWindow = window as Window & { __gridMapTest?: GridMapTestHook };
  tested.maplibreMap = map;
  // Read-only counts for live checks. The same object sits on the container,
  // which Playwright already uses. It is not a control on the page.
  const testHook: GridMapTestHook = Object.freeze({
    labelCount: () => renderedCount(LABEL_LAYERS),
    flowCount: () => renderedCount([...FLOW_LINE_LAYERS, ...FLOW_MARKER_LAYERS]),
    flowLineCount: () => renderedCount(FLOW_LINE_LAYERS),
    flowMarkerCount: () => renderedCount(FLOW_MARKER_LAYERS),
    project: (longitude, latitude) => {
      const projected = map.project([longitude, latitude]);
      if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) {
        return null;
      }
      return { x: projected.x, y: projected.y };
    },
    labelsAboveStations: () => {
      const ids = (map.getStyle()?.layers ?? []).map((layer) => layer.id);
      const marker = ids.indexOf("station-markers");
      if (marker < 0) {
        return false;
      }
      return LABEL_LAYERS.every((id) => ids.indexOf(id) > marker);
    },
    stationDots: () => {
      if (!stationsOn || !map.getLayer("station-markers")) {
        return [];
      }
      const dots: { x: number; y: number; radius: number }[] = [];
      for (const feature of stations.features) {
        const projected = map.project(feature.geometry.coordinates);
        if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) {
          continue;
        }
        dots.push({ x: projected.x, y: projected.y, radius: feature.properties.radius });
      }
      return dots;
    },
  });
  tested.__gridMapTest = testHook;
  Object.defineProperty(testWindow, "__gridMapTest", {
    configurable: true,
    enumerable: false,
    writable: false,
    value: testHook,
  });
  const resizeObserver = new ResizeObserver(() => {
    map.resize();
  });
  resizeObserver.observe(container);
  requestAnimationFrame(() => {
    map.resize();
    requestAnimationFrame(() => {
      map.resize();
    });
  });
  map.setStyle(styleUrl(theme), { transformStyle });

  const onVisibility = () => {
    hidden = document.visibilityState === "hidden";
    if (hidden) {
      stopMotion();
    } else {
      startMotion();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  return {
    destroy: () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopMotion();
      resizeObserver.disconnect();
      delete tested.maplibreMap;
      delete tested.__gridMapTest;
      if (testWindow.__gridMapTest === testHook) {
        delete testWindow.__gridMapTest;
      }
      map.remove();
    },
    setLines: (next) => {
      lines = next.slice();
      if (ready) {
        paintLines();
      }
    },
    setVisibility: (next) => {
      electricity = next.electricity;
      gas = next.gas;
      dno = next.dno;
      stationsOn = next.stations;
      if (!ready) {
        return;
      }
      paintLines();
      addDno();
      for (const id of ["station-markers", "station-hit"] as const) {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, "visibility", stationsOn ? "visible" : "none");
        }
      }
    },
    setSelected: (id) => {
      const line = lines.find((item) => item.id === id);
      if (!line || !ready) {
        return;
      }
      const points = [line.gb, line.remote].filter((point): point is [number, number] => point !== null);
      const first = points[0];
      if (!first) {
        return;
      }
      if (points.length === 1) {
        const move = { center: first, zoom: Math.max(map.getZoom(), 5.5) };
        if (reduceMotion) {
          map.jumpTo(move);
        } else {
          map.easeTo(move);
        }
        return;
      }
      let west = first[0];
      let east = first[0];
      let south = first[1];
      let north = first[1];
      for (const point of points) {
        west = Math.min(west, point[0]);
        east = Math.max(east, point[0]);
        south = Math.min(south, point[1]);
        north = Math.max(north, point[1]);
      }
      const camera = clampToMapBounds({ west, south, east, north });
      map.fitBounds(
        [
          [camera.west, camera.south],
          [camera.east, camera.north],
        ],
        { padding: overviewPadding(), maxZoom: 6.5, animate: !reduceMotion },
      );
    },
    setStations: (collection) => {
      stations = collection;
      if (ready) {
        addStationLayers();
      }
    },
    setTheme: (next) => {
      if (next === theme) {
        return;
      }
      theme = next;
      stopMotion();
      ready = false;
      styleLoaded = false;
      basemapLoaded = false;
      pointersBound = false;
      map.setStyle(styleUrl(next), { transformStyle });
    },
  };
}
