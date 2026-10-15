import { addProtocol, GeoJSONSource, Map, NavigationControl, setWorkerUrl } from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  assetFeatureCollection,
  capacityRadiusExpression,
  technologyColorExpression,
} from "@/lib/map/asset-layer";
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

export type PowerMapHandle = {
  destroy: () => void;
  setDnoVisible: (visible: boolean) => void;
  setAssetsVisible: (visible: boolean) => void;
  setTheme: (theme: MapTheme) => void;
  setSelected: (id: string | null) => void;
};

export function mountPowerMap(
  container: HTMLElement,
  options: {
    points: readonly MapPoint[];
    dnoPath: string;
    dnoVisible: boolean;
    assetsVisible: boolean;
    selectedId: string | null;
    onStatus: (status: MapMountStatus) => void;
    onSelect: (id: string) => void;
  },
): PowerMapHandle {
  ensureProtocol();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let theme = themeOf(document.documentElement);
  let dnoVisible = options.dnoVisible;
  let assetsVisible = options.assetsVisible;
  let selectedId = options.selectedId;
  let framed = false;
  let ready = false;
  let basemapLoaded = false;

  const map = new Map({
    container,
    style: styleUrl(theme),
    attributionControl: false,
    keyboard: true,
    cooperativeGestures: true,
    fadeDuration: reduceMotion ? 0 : 300,
    center: [-2.5, 54.5],
    zoom: 5,
  });
  map.addControl(new NavigationControl({ showCompass: false, visualizePitch: false }), "top-right");

  const canvas = map.getCanvas();
  canvas.setAttribute("role", "application");
  canvas.setAttribute("aria-label", `Power assets. ${MAP_KEYBOARD_COPY}`);

  function visibility(visible: boolean): "visible" | "none" {
    return visible ? "visible" : "none";
  }

  function addAssetLayers(): void {
    const collection = assetFeatureCollection(options.points);
    if (!map.getSource("assets")) {
      map.addSource("assets", {
        type: "geojson",
        data: collection,
        cluster: options.points.length > 1,
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
    }
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
    if (!map.getLayer("asset-points")) {
      return;
    }
    map.setPaintProperty("asset-points", "circle-stroke-width", [
      "case",
      ["==", ["get", "id"], selectedId ?? ""],
      3,
      1,
    ]);
  }

  function frame(): void {
    if (framed) {
      return;
    }
    framed = true;
    const selected = selectedId ? options.points.find((point) => point.id === selectedId) : undefined;
    if (selected) {
      map.jumpTo({ center: [selected.longitude, selected.latitude], zoom: 10 });
      return;
    }
    if (options.points.length === 0) {
      return;
    }
    if (options.points.length === 1) {
      const only = options.points[0];
      if (only) {
        map.jumpTo({ center: [only.longitude, only.latitude], zoom: 10 });
      }
      return;
    }
    const first = options.points[0];
    if (!first) {
      return;
    }
    let west = first.longitude;
    let east = first.longitude;
    let south = first.latitude;
    let north = first.latitude;
    for (const point of options.points) {
      west = Math.min(west, point.longitude);
      east = Math.max(east, point.longitude);
      south = Math.min(south, point.latitude);
      north = Math.max(north, point.latitude);
    }
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: 36, maxZoom: 8, animate: false },
    );
  }

  function paint(): void {
    addAssetLayers();
    addDnoLayers();
    applySelection();
    frame();
    if (!ready) {
      ready = true;
      options.onStatus("ready");
    }
  }

  map.on("style.load", paint);
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
  map.on("error", () => {
    if (basemapLoaded) {
      return;
    }
    options.onStatus("error");
  });

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
    setTheme: (next: MapTheme) => {
      if (next === theme) {
        return;
      }
      theme = next;
      map.setStyle(styleUrl(next));
    },
    setSelected: (id: string | null) => {
      selectedId = id;
      applySelection();
      const selected = id ? options.points.find((point) => point.id === id) : undefined;
      if (!selected) {
        return;
      }
      const move = { center: [selected.longitude, selected.latitude] as [number, number], zoom: Math.max(map.getZoom(), 10) };
      if (reduceMotion) {
        map.jumpTo(move);
      } else {
        map.easeTo(move);
      }
    },
  };
}
