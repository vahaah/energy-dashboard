import { addProtocol, GeoJSONSource, Map, NavigationControl, setWorkerUrl } from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";
import { transformBasemapStyle as transformStyle } from "@/lib/map/absolute-style";
import { CHEVRON_CYCLE_MS, ELECTRICITY_DIRECTION, GAS_DIRECTION } from "@/lib/map/flow-scale";
import { FLOWS_KEYBOARD, FLOWS_TITLE } from "@/lib/map/flows-copy";
import type { StationFeatureCollection } from "@/lib/map/stations-layer";
import type { MarkerShape } from "@/lib/map/marker";

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
  properties: { id: string; name: string; kind: string; width: number; bucket: "fresh" | "quiet"; color: string };
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

function lineFeatures(lines: readonly FlowDrawLine[], imports: string, gas: string, amber: string, quiet: string): LineFeature[] {
  const features: LineFeature[] = [];
  for (const line of lines) {
    const start = line.remote ?? offshore(line.gb);
    const towardTerminal =
      line.direction === ELECTRICITY_DIRECTION.import || line.direction === GAS_DIRECTION.into;
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

function drawShape(context: CanvasRenderingContext2D, shape: MarkerShape, x: number, y: number, radius: number, color: string): void {
  context.save();
  context.translate(x, y);
  context.fillStyle = color;
  context.strokeStyle = color;
  context.lineWidth = 1.5;
  context.beginPath();
  switch (shape) {
    case "circle":
      context.arc(0, 0, radius, 0, Math.PI * 2);
      context.fill();
      break;
    case "diamond":
      context.moveTo(0, -radius);
      context.lineTo(radius, 0);
      context.lineTo(0, radius);
      context.lineTo(-radius, 0);
      context.closePath();
      context.fill();
      break;
    case "square":
      context.rect(-radius * 0.78, -radius * 0.78, radius * 1.56, radius * 1.56);
      context.fill();
      break;
    case "triangle":
      context.moveTo(0, -radius);
      context.lineTo(radius * 0.92, radius * 0.78);
      context.lineTo(-radius * 0.92, radius * 0.78);
      context.closePath();
      context.fill();
      break;
    case "triangle-down":
      context.moveTo(0, radius);
      context.lineTo(radius * 0.92, -radius * 0.78);
      context.lineTo(-radius * 0.92, -radius * 0.78);
      context.closePath();
      context.fill();
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
      context.fill();
      break;
    case "plus":
      context.rect(-radius * 0.32, -radius, radius * 0.64, radius * 2);
      context.rect(-radius, -radius * 0.32, radius * 2, radius * 0.64);
      context.fill();
      break;
    case "ring":
      context.arc(0, 0, radius, 0, Math.PI * 2);
      context.stroke();
      break;
    default: {
      const neverShape: never = shape;
      void neverShape;
      break;
    }
  }
  context.restore();
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
  overlay: HTMLCanvasElement,
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
  let stations: StationFeatureCollection = { type: "FeatureCollection", features: [] };
  let pointersBound = false;
  let ready = false;
  let basemapLoaded = false;
  let frame = 0;
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
    zoom: 4.4,
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
      points: { type: "FeatureCollection" as const, features: pointFeatures(shown) },
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
      map.addSource("flow-hover", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
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
        paint: { "line-color": "#000000", "line-width": HIT_LINE, "line-opacity": 0.01 },
      });
      map.addLayer({
        id: "flow-marker-hit",
        type: "circle",
        source: "flow-points",
        paint: { "circle-radius": HIT_RADIUS, "circle-color": "#000000", "circle-opacity": 0.01 },
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
        const midpoint = geometry && geometry.type === "LineString" ? (geometry.coordinates[0] as [number, number]) : coordinates;
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

  function addStationHit(): void {
    if (!map.getSource("stations")) {
      map.addSource("stations", { type: "geojson", data: stations });
      map.addLayer({
        id: "station-hit",
        type: "circle",
        source: "stations",
        layout: { visibility: stationsOn ? "visible" : "none" },
        paint: { "circle-radius": HIT_RADIUS, "circle-color": "#000000", "circle-opacity": 0.01 },
      });
    } else {
      const source = map.getSource("stations");
      if (source instanceof GeoJSONSource) {
        source.setData(stations);
      }
      if (map.getLayer("station-hit")) {
        map.setLayoutProperty("station-hit", "visibility", stationsOn ? "visible" : "none");
      }
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
        { id: "dno-fill", type: "fill", source: "dno", paint: { "fill-color": "#3291ff", "fill-opacity": 0.12 } },
        map.getLayer("flow-quiet") ? "flow-quiet" : undefined,
      );
      map.addLayer(
        { id: "dno-line", type: "line", source: "dno", paint: { "line-color": "#3291ff", "line-width": 1 } },
        map.getLayer("flow-quiet") ? "flow-quiet" : undefined,
      );
    }
    map.setLayoutProperty("dno-fill", "visibility", "visible");
    map.setLayoutProperty("dno-line", "visibility", "visible");
  }

  function extendSea(): void {
    const sea = map.getPaintProperty("sea", "fill-color");
    if (typeof sea === "string" && map.getLayer("background")) {
      map.setPaintProperty("background", "background-color", sea);
    }
  }

  function frameView(): void {
    const shown = lines.filter((line) => visible(line.kind));
    if (shown.length === 0) {
      return;
    }
    let west = shown[0]?.gb[0] ?? -8;
    let east = west;
    let south = shown[0]?.gb[1] ?? 50;
    let north = south;
    for (const line of shown) {
      const points = [line.gb, line.remote].filter((point): point is [number, number] => point !== null);
      for (const point of points) {
        west = Math.min(west, point[0]);
        east = Math.max(east, point[0]);
        south = Math.min(south, point[1]);
        north = Math.max(north, point[1]);
      }
    }
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: 36, maxZoom: 6, animate: false },
    );
  }

  function drawOverlay(): void {
    const rect = container.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    overlay.width = Math.max(1, Math.floor(rect.width * ratio));
    overlay.height = Math.max(1, Math.floor(rect.height * ratio));
    const context = overlay.getContext("2d");
    if (!context) {
      return;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    if (!stationsOn) {
      return;
    }
    for (const feature of stations.features) {
      const projected = map.project(feature.geometry.coordinates);
      drawShape(context, feature.properties.shape, projected.x, projected.y, feature.properties.radius, feature.properties.color);
    }
  }

  function tick(): void {
    frame = 0;
    if (!ready || reduceMotion || hidden || !map.getLayer("flow-fresh")) {
      return;
    }
    const phase = (performance.now() % CHEVRON_CYCLE_MS) / CHEVRON_CYCLE_MS;
    const dash = 2;
    const gap = 2;
    const offset = phase * (dash + gap);
    map.setPaintProperty("flow-fresh", "line-dasharray", [offset, dash, Math.max(0.01, gap + dash - offset), 0.01]);
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
    if (map.getLayer("flow-fresh")) {
      map.setPaintProperty("flow-fresh", "line-dasharray", [2, 2]);
    }
  }

  function paint(): void {
    extendSea();
    addFlowLayers();
    addStationHit();
    addDno();
    if (!pointersBound) {
      bindPointers();
      pointersBound = true;
    }
    if (!ready) {
      frameView();
      ready = true;
      options.onStatus("ready");
      startMotion();
    }
    drawOverlay();
  }

  map.on("style.load", paint);
  map.on("move", drawOverlay);
  map.on("resize", drawOverlay);
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
    if (!basemapLoaded) {
      options.onStatus("error");
    }
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
      map.remove();
    },
    setLines: (next) => {
      lines = next.slice();
      if (ready) {
        paintLines();
        drawOverlay();
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
      if (map.getLayer("station-hit")) {
        map.setLayoutProperty("station-hit", "visibility", stationsOn ? "visible" : "none");
      }
      drawOverlay();
    },
    setSelected: (id) => {
      const line = lines.find((item) => item.id === id);
      if (line && ready) {
        const move = { center: line.gb, zoom: Math.max(map.getZoom(), 5.5) };
        if (reduceMotion) {
          map.jumpTo(move);
        } else {
          map.easeTo(move);
        }
      }
    },
    setStations: (collection) => {
      stations = collection;
      if (ready) {
        addStationHit();
        drawOverlay();
      }
    },
    setTheme: (next) => {
      if (next === theme) {
        return;
      }
      theme = next;
      stopMotion();
      ready = false;
      pointersBound = false;
      map.setStyle(styleUrl(next), { transformStyle });
    },
  };
}
