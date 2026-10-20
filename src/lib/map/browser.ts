import { addProtocol, GeoJSONSource, Map, NavigationControl, setWorkerUrl } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { transformBasemapStyle as transformStyle } from "@/lib/map/absolute-style";
import { basemapStartupFailed } from "@/lib/map/startup-error";
import {
  assetFeatureCollection,
  capacityRadiusExpression,
  technologyColorExpression,
} from "@/lib/map/asset-layer";
import { BASEMAP_DETAIL_MIN_ZOOM, GB_FRAME_BOUNDS, MAP_CAMERA_MIN_ZOOM, MAP_MAX_BOUNDS, clampOverviewBounds, clampToMapBounds } from "@/lib/map/constants";
import type { MapBounds } from "@/lib/map/counts";
import { interconnectorFeatureCollection, type InterconnectorLine } from "@/lib/map/interconnector-layer";
import type { MapPoint } from "@/lib/assets/types";
import { MAP_KEYBOARD_COPY } from "@/lib/assets/labels";

export type MapTheme = "light" | "dark";
export type MapMountStatus = "ready" | "error";

const MAPLIBRE_WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

let protocolReady = false;

function ensureProtocol(): void {
  if (protocolReady) {
    return;
  }
  setWorkerUrl(MAPLIBRE_WORKER_URL);
  const protocol = new Protocol();
  addProtocol("pmtiles", protocol.tile);
  protocolReady = true;
}

function themeOf(root: HTMLElement): MapTheme {
  return root.classList.contains("dark") ? "dark" : "light";
}

function styleUrl(theme: MapTheme): string {
  return theme === "dark" ? "/basemap/style-dark.json" : "/basemap/style-light.json";
}

const IMPORTS_FALLBACK = "#64748b";

function importsColor(): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--chart-imports").trim();
  return value.length > 0 ? value : IMPORTS_FALLBACK;
}

export type PowerMapHandle = {
  destroy: () => void;
  setDnoVisible: (visible: boolean) => void;
  setAssetsVisible: (visible: boolean) => void;
  setLinesVisible: (visible: boolean) => void;
  setPoints: (points: readonly MapPoint[]) => void;
  setLines: (lines: readonly InterconnectorLine[]) => void;
  setTheme: (theme: MapTheme) => void;
  setSelected: (id: string | null) => void;
};

export function mountPowerMap(
  container: HTMLElement,
  options: {
    points: readonly MapPoint[];
    lines: readonly InterconnectorLine[];
    dnoPath: string;
    dnoVisible: boolean;
    assetsVisible: boolean;
    linesVisible: boolean;
    selectedId: string | null;
    onStatus: (status: MapMountStatus) => void;
    onSelect: (id: string) => void;
    onView?: (bounds: MapBounds) => void;
  },
): PowerMapHandle {
  ensureProtocol();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let theme = themeOf(document.documentElement);
  let points = options.points.slice();
  let lines = options.lines.slice();
  let dnoVisible = options.dnoVisible;
  let assetsVisible = options.assetsVisible;
  let linesVisible = options.linesVisible;
  let selectedId = options.selectedId;
  let framed = false;
  let ready = false;
  let styleLoaded = false;
  let basemapLoaded = false;
  let lineClicksBound = false;

  // MapLibre 6.14 only applies transformStyle inside setStyle. MapOptions
  // has no such field, and the constructor's setStyle drops it.
  const map = new Map({
    container,
    attributionControl: false,
    keyboard: true,
    cooperativeGestures: true,
    fadeDuration: reduceMotion ? 0 : 300,
    center: [-2.5, 54.5],
    zoom: BASEMAP_DETAIL_MIN_ZOOM,
    minZoom: MAP_CAMERA_MIN_ZOOM,
    maxBounds: MAP_MAX_BOUNDS,
  });
  map.addControl(new NavigationControl({ showCompass: false, visualizePitch: false }), "top-right");

  const canvas = map.getCanvas();
  canvas.setAttribute("role", "application");
  canvas.setAttribute("aria-label", `Power assets. ${MAP_KEYBOARD_COPY}`);

  function visibility(visible: boolean): "visible" | "none" {
    return visible ? "visible" : "none";
  }

  function addAssetLayers(): void {
    const collection = assetFeatureCollection(points);
    if (!map.getSource("assets")) {
      map.addSource("assets", {
        type: "geojson",
        data: collection,
        cluster: true,
        clusterRadius: 48,
        clusterMaxZoom: 11,
        clusterProperties: {
          mw: ["+", ["coalesce", ["get", "mw"], 0]],
        },
      });
    }
    if (!map.getLayer("asset-clusters")) {
      map.addLayer({
        id: "asset-clusters",
        type: "circle",
        source: "assets",
        filter: ["has", "point_count"],
        layout: { visibility: visibility(assetsVisible) },
        paint: {
          "circle-color": theme === "dark" ? "#d4d4d4" : "#404040",
          "circle-opacity": 0.88,
          "circle-stroke-color": theme === "dark" ? "#0a0a0a" : "#ffffff",
          "circle-stroke-width": 1,
          "circle-radius": ["interpolate", ["linear"], ["get", "point_count"], 2, 14, 20, 18, 100, 26, 500, 34],
        },
      });
      map.addLayer({
        id: "asset-cluster-count",
        type: "symbol",
        source: "assets",
        filter: ["has", "point_count"],
        layout: {
          visibility: visibility(assetsVisible),
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Geist Sans Regular"],
          "text-size": 12,
        },
        paint: {
          "text-color": theme === "dark" ? "#171717" : "#ffffff",
        },
      });
    }
    if (!map.getLayer("asset-points")) {
      map.addLayer({
        id: "asset-points",
        type: "circle",
        source: "assets",
        filter: ["!", ["has", "point_count"]],
        layout: { visibility: visibility(assetsVisible) },
        paint: {
          "circle-color": technologyColorExpression() as never,
          "circle-radius": capacityRadiusExpression() as never,
          "circle-opacity": 0.92,
          "circle-stroke-color": theme === "dark" ? "#fafafa" : "#171717",
          "circle-stroke-width": ["case", ["==", ["get", "id"], selectedId ?? ""], 3, 1],
        },
      });
    } else {
      const source = map.getSource("assets");
      if (source instanceof GeoJSONSource) {
        source.setData(collection);
      }
    }
  }

  function bindLineClicks(): void {
    if (lineClicksBound || !map.getLayer("interconnector-lines")) {
      return;
    }
    lineClicksBound = true;
    map.on("click", "interconnector-lines", (event) => {
      const id = event.features?.[0]?.properties.id;
      if (typeof id === "string") {
        options.onSelect(id);
      }
    });
    map.on("mouseenter", "interconnector-lines", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "interconnector-lines", () => {
      map.getCanvas().style.cursor = "";
    });
  }

  function addLineLayers(): void {
    const collection = interconnectorFeatureCollection(lines);
    const color = importsColor();
    if (!map.getSource("interconnectors")) {
      map.addSource("interconnectors", { type: "geojson", data: collection });
      map.addLayer({
        id: "interconnector-lines",
        type: "line",
        source: "interconnectors",
        layout: { visibility: visibility(linesVisible) },
        paint: {
          "line-color": color,
          "line-width": 2,
          "line-dasharray": [2, 2],
        },
      });
    } else {
      const source = map.getSource("interconnectors");
      if (source instanceof GeoJSONSource) {
        source.setData(collection);
      }
      if (map.getLayer("interconnector-lines")) {
        map.setPaintProperty("interconnector-lines", "line-color", color);
        map.setLayoutProperty("interconnector-lines", "visibility", visibility(linesVisible));
      }
    }
    bindLineClicks();
  }

  function addDnoLayers(): void {
    if (!dnoVisible) {
      if (map.getLayer("dno-fill")) {
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
          paint: { "fill-color": "#3291ff", "fill-opacity": 0.14 },
        },
        map.getLayer("asset-clusters") ? "asset-clusters" : undefined,
      );
      map.addLayer(
        {
          id: "dno-line",
          type: "line",
          source: "dno",
          paint: { "line-color": "#3291ff", "line-width": 1.25 },
        },
        map.getLayer("asset-clusters") ? "asset-clusters" : undefined,
      );
    }
    map.setLayoutProperty("dno-fill", "visibility", "visible");
    map.setLayoutProperty("dno-line", "visibility", "visible");
  }

  function applySelection(): void {
    if (map.getLayer("asset-points")) {
      map.setPaintProperty("asset-points", "circle-stroke-width", [
        "case",
        ["==", ["get", "id"], selectedId ?? ""],
        3,
        1,
      ]);
    }
    if (map.getLayer("interconnector-lines")) {
      map.setPaintProperty("interconnector-lines", "line-width", [
        "case",
        ["==", ["get", "id"], selectedId ?? ""],
        4,
        2,
      ]);
    }
  }

  function focus(longitude: number, latitude: number, zoomFloor: number): void {
    const move = { center: [longitude, latitude] as [number, number], zoom: Math.max(map.getZoom(), zoomFloor) };
    if (reduceMotion) {
      map.jumpTo(move);
    } else {
      map.easeTo(move);
    }
  }

  function frame(): void {
    if (framed) {
      return;
    }
    framed = true;
    const selectedPoint = selectedId ? points.find((point) => point.id === selectedId) : undefined;
    if (selectedPoint) {
      map.jumpTo({ center: [selectedPoint.longitude, selectedPoint.latitude], zoom: 10 });
      return;
    }
    const selectedLine = selectedId ? lines.find((line) => line.id === selectedId) : undefined;
    if (selectedLine) {
      map.jumpTo({
        center: [
          (selectedLine.gbLongitude + selectedLine.remoteLongitude) / 2,
          (selectedLine.gbLatitude + selectedLine.remoteLatitude) / 2,
        ],
        zoom: 5,
      });
      return;
    }
    let west = GB_FRAME_BOUNDS.west;
    let east = GB_FRAME_BOUNDS.east;
    let south = GB_FRAME_BOUNDS.south;
    let north = GB_FRAME_BOUNDS.north;
    for (const point of points) {
      west = Math.min(west, point.longitude);
      east = Math.max(east, point.longitude);
      south = Math.min(south, point.latitude);
      north = Math.max(north, point.latitude);
    }
    for (const line of lines) {
      west = Math.min(west, line.gbLongitude, line.remoteLongitude);
      east = Math.max(east, line.gbLongitude, line.remoteLongitude);
      south = Math.min(south, line.gbLatitude, line.remoteLatitude);
      north = Math.max(north, line.gbLatitude, line.remoteLatitude);
    }
    const width = container.clientWidth;
    const padding = width < 720 ? { top: 36, right: 44, bottom: 20, left: 12 } : 48;
    const camera = clampOverviewBounds({ west, south, east, north });
    map.fitBounds(
      [
        [camera.west, camera.south],
        [camera.east, camera.north],
      ],
      { padding, maxZoom: 6.5, animate: false },
    );
  }

  function reportBounds(): void {
    const bounds = map.getBounds();
    options.onView?.({
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    });
  }

  function paint(): void {
    addAssetLayers();
    addLineLayers();
    addDnoLayers();
    applySelection();
    frame();
    reportBounds();
    if (!ready) {
      ready = true;
      options.onStatus("ready");
    }
  }

  map.on("style.load", () => {
    styleLoaded = true;
    paint();
  });
  map.on("resize", () => {
    if (selectedId) {
      return;
    }
    framed = false;
    frame();
  });
  map.on("moveend", reportBounds);
  map.on("click", "asset-clusters", (event) => {
    const feature = event.features?.[0];
    const source = map.getSource("assets");
    if (!feature || feature.geometry.type !== "Point" || !(source instanceof GeoJSONSource)) {
      return;
    }
    const clusterId = feature.properties.cluster_id;
    if (typeof clusterId !== "number") {
      return;
    }
    const coordinates = feature.geometry.coordinates;
    void source.getClusterExpansionZoom(clusterId).then((zoom) => {
      const move = { center: [coordinates[0] ?? 0, coordinates[1] ?? 0] as [number, number], zoom };
      if (reduceMotion) {
        map.jumpTo(move);
      } else {
        map.easeTo(move);
      }
    });
  });
  map.on("click", "asset-points", (event) => {
    const id = event.features?.[0]?.properties.id;
    if (typeof id === "string") {
      options.onSelect(id);
    }
  });
  map.on("mouseenter", "asset-points", () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "asset-points", () => {
    map.getCanvas().style.cursor = "";
  });
  map.on("mouseenter", "asset-clusters", () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "asset-clusters", () => {
    map.getCanvas().style.cursor = "";
  });
  map.on("sourcedata", (event) => {
    if (event.sourceId !== "zoomstack" || !map.getSource("zoomstack") || !map.isSourceLoaded("zoomstack")) {
      return;
    }
    basemapLoaded = true;
    options.onStatus("ready");
  });
  map.on("error", (ev) => {
    if (process.env.NODE_ENV === "development") {
      console.error(ev.error);
    }
    if (basemapStartupFailed(ev, styleLoaded, basemapLoaded)) {
      options.onStatus("error");
    }
  });
  map.setStyle(styleUrl(theme), { transformStyle });

  return {
    destroy: () => {
      map.remove();
    },
    setDnoVisible: (visible: boolean) => {
      dnoVisible = visible;
      if (ready) {
        addDnoLayers();
      }
    },
    setAssetsVisible: (visible: boolean) => {
      assetsVisible = visible;
      if (!map.getLayer("asset-points")) {
        return;
      }
      const value = visibility(visible);
      map.setLayoutProperty("asset-clusters", "visibility", value);
      map.setLayoutProperty("asset-cluster-count", "visibility", value);
      map.setLayoutProperty("asset-points", "visibility", value);
    },
    setLinesVisible: (visible: boolean) => {
      linesVisible = visible;
      if (!map.getLayer("interconnector-lines")) {
        return;
      }
      map.setLayoutProperty("interconnector-lines", "visibility", visibility(visible));
    },
    setPoints: (next: readonly MapPoint[]) => {
      points = next.slice();
      if (!ready) {
        return;
      }
      addAssetLayers();
    },
    setLines: (next: readonly InterconnectorLine[]) => {
      lines = next.slice();
      if (!ready) {
        return;
      }
      addLineLayers();
      applySelection();
    },
    setTheme: (next: MapTheme) => {
      if (next === theme) {
        return;
      }
      theme = next;
      styleLoaded = false;
      basemapLoaded = false;
      ready = false;
      framed = false;
      map.setStyle(styleUrl(next), { transformStyle });
    },
    setSelected: (id: string | null) => {
      selectedId = id;
      applySelection();
      const selected = id ? points.find((point) => point.id === id) : undefined;
      if (selected) {
        focus(selected.longitude, selected.latitude, 10);
        return;
      }
      const line = id ? lines.find((item) => item.id === id) : undefined;
      if (!line) {
        return;
      }
      const camera = clampToMapBounds({
        west: Math.min(line.gbLongitude, line.remoteLongitude),
        east: Math.max(line.gbLongitude, line.remoteLongitude),
        south: Math.min(line.gbLatitude, line.remoteLatitude),
        north: Math.max(line.gbLatitude, line.remoteLatitude),
      });
      map.fitBounds(
        [
          [camera.west, camera.south],
          [camera.east, camera.north],
        ],
        { padding: 48, maxZoom: 6.5, animate: !reduceMotion },
      );
    },
  };
}
