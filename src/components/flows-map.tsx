"use client";

import Link from "next/link";
import { useQueryStates } from "nuqs";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { formatEnergyText } from "@/lib/format/quantity";
import { assetPath } from "@/lib/assets/href";
import { mapViewParsers } from "@/lib/assets/params";
import { NI_FLOW_NOTE } from "@/lib/attribution";
import { NI_PATH } from "@/lib/eirgrid/copy";
import { SiteLegalNav } from "@/components/site-legal-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { FLOW_SHEET_PEEK_PX } from "@/lib/map/constants";
import {
  ELECTRICITY_BANNER_STALE_MS,
  ELECTRICITY_STALE_MS,
  GAS_STALE_MS,
  flowListLine,
  netElectricityLabel,
  netGasLabel,
  readingIsStale,
} from "@/lib/map/flow-scale";
import {
  FEED_FAILED,
  FLOWS_FALLBACK_HREF,
  FLOWS_KEYBOARD,
  FLOWS_PANEL_EMPTY,
  FLOWS_PANEL_LABEL,
  FLOW_WIDTH_KEY,
  MAP_FAILED,
  PROJECTS_LAYER_NOTE,
  STATIONS_PANEL_EMPTY,
  STATIONS_PANEL_LABEL,
  STATIONS_STANDFIRST,
  STATIONS_TITLE,
  londonClock,
  staleCopy,
} from "@/lib/map/flows-copy";
import { flowSelectionFromQuery, layerOn, withLayer } from "@/lib/map/flows-selection";
import type { FlowsFeature, FlowsPageModel } from "@/lib/map/flows-types";
import type { FlowsMapHandle } from "@/lib/map/flows-browser";
import { sparklinePath } from "@/lib/map/sparkline";
import { startStaleClock } from "@/lib/map/stale-clock";
import { documentTheme } from "@/lib/theme";
import type { StationFeatureCollection } from "@/lib/map/stations-layer";
import type { MarkerShape } from "@/lib/map/marker";

type Preset = "flows" | "stations";
type Snap = typeof FLOW_SHEET_PEEK_PX | 430 | "full";

type StationPick = {
  id: string;
  name: string;
  group: string;
  mw: number | null;
  href: string;
};

function ShapeMark({ shape, color }: { shape: MarkerShape; color: string }) {
  switch (shape) {
    case "circle":
      return <span className="inline-block size-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
    case "diamond":
      return <span className="inline-block size-3 shrink-0 rotate-45" style={{ backgroundColor: color }} />;
    case "square":
      return <span className="inline-block size-3 shrink-0" style={{ backgroundColor: color }} />;
    case "triangle":
      return (
        <span
          className="inline-block size-0 shrink-0 border-x-[6px] border-b-[10px] border-x-transparent"
          style={{ borderBottomColor: color }}
        />
      );
    case "triangle-down":
      return (
        <span
          className="inline-block size-0 shrink-0 border-x-[6px] border-t-[10px] border-x-transparent"
          style={{ borderTopColor: color }}
        />
      );
    case "hexagon":
      return (
        <span
          className="inline-block size-3 shrink-0 [clip-path:polygon(25%_0,75%_0,100%_50%,75%_100%,25%_100%,0_50%)]"
          style={{ backgroundColor: color }}
        />
      );
    case "plus":
      return (
        <span className="inline-block shrink-0 text-label-12" style={{ color }}>
          +
        </span>
      );
    case "ring":
      return <span className="inline-block size-3 shrink-0 rounded-full border-2" style={{ borderColor: color }} />;
    default: {
      const neverShape: never = shape;
      return neverShape;
    }
  }
}

function Sparkline({ values }: { values: (number | null)[] | null }) {
  const path = values ? sparklinePath(values, 220, 36) : null;
  if (!path) {
    return <p className="text-copy-14 text-gray-900">—</p>;
  }
  return (
    <svg viewBox="0 0 220 36" className="h-9 w-full" role="img" aria-label="24 hour reading">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function FlowDetails({ feature }: { feature: FlowsFeature }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 break-words">
      <div>
        <h2 className="text-heading-16 text-gray-1000">{feature.name}</h2>
        {feature.counterparty ? <p className="text-copy-14 text-gray-900">{feature.counterparty}</p> : null}
      </div>
      <p className="text-copy-14 text-gray-1000">
        Landing point: {feature.landing}
        {feature.remoteLanding ? ` and ${feature.remoteLanding}` : ""}. Schematic.
      </p>
      <p className="text-copy-14 text-gray-1000">Capacity: {feature.capacityLabel}</p>
      {feature.utilisation ? <p className="text-copy-14 text-gray-1000">{feature.utilisation}</p> : null}
      <p className="text-copy-16 text-gray-1000">
        Latest reading: {feature.reading}
        {feature.readingAt ? ` at ${londonClock(new Date(feature.readingAt))}` : ""}
      </p>
      {feature.direction ? (
        <p className="inline-flex w-fit rounded-md border border-gray-alpha-400 px-2 py-1 text-label-13 text-gray-1000">
          {feature.direction}
        </p>
      ) : null}
      <Sparkline values={feature.spark} />
      <p className="text-copy-14 text-gray-900">{feature.credit}</p>
      <p>
        <Link href={feature.href} className="text-blue-700 underline-offset-2 hover:underline">
          Asset page →
        </Link>
      </p>
    </div>
  );
}

function StationDetails({ station }: { station: StationPick }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 break-words">
      <h2 className="text-heading-16 text-gray-1000">{station.name}</h2>
      <p className="text-copy-14 text-gray-1000">{station.group}</p>
      <p className="text-copy-14 text-gray-1000">
        Rated power: {station.mw === null ? "—" : formatEnergyText(station.mw)}
      </p>
      <p>
        <Link href={station.href} className="text-blue-700 underline-offset-2 hover:underline">
          Asset page →
        </Link>
      </p>
    </div>
  );
}

function FlowList({
  features,
  selectedId,
  onSelect,
}: {
  features: readonly FlowsFeature[];
  selectedId: string | null;
  onSelect: (id: string, button: HTMLButtonElement) => void;
}) {
  return (
    <ul data-flow-list className="flex min-w-0 flex-col">
      {features.map((feature) => {
        const selected = feature.id === selectedId;
        return (
          <li key={feature.id} className="min-w-0 border-t border-gray-alpha-400">
            <button
              type="button"
              aria-current={selected ? "true" : undefined}
              onClick={(event) => onSelect(feature.id, event.currentTarget)}
              className="flex w-full min-w-0 flex-col gap-0.5 py-2 text-left"
            >
              <span className="text-copy-14 text-gray-1000">{feature.name}</span>{" "}
              <span className="text-label-12 text-gray-900">{flowListLine(feature.direction, feature.reading)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function FlowsMap({ model }: { model: FlowsPageModel }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const handle = useRef<FlowsMapHandle | null>(null);
  const focusRef = useRef<HTMLButtonElement | null>(null);
  const stationsRef = useRef<StationFeatureCollection | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const chooseRef = useRef<(id: string, button: HTMLButtonElement | null, syncUrl?: boolean) => boolean>(() => false);
  const loadStationsRef = useRef<() => void>(() => undefined);
  const layersApplied = useRef<string | null>(null);
  const electricityRef = useRef(true);
  const gasRef = useRef(true);
  const dnoRef = useRef(false);
  const stationsOnRef = useRef(false);
  const drawLinesRef = useRef<() => ReturnType<typeof drawLines>>(() => []);
  const [url, setUrl] = useQueryStates(mapViewParsers, {
    history: "replace",
    shallow: true,
    scroll: false,
  });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [preset, setPreset] = useState<Preset>("flows");
  const [electricity, setElectricity] = useState(true);
  const [gas, setGas] = useState(true);
  const [stationsOn, setStationsOn] = useState(false);
  const [dno, setDno] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [station, setStation] = useState<StationPick | null>(null);
  const [stations, setStations] = useState<StationFeatureCollection | null>(null);
  const [snap, setSnap] = useState<Snap>(FLOW_SHEET_PEEK_PX);
  const [about, setAbout] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 64rem)");
    const apply = () => setDesktop(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const selected = model.features.find((feature) => feature.id === selectedId) ?? null;
  stationsRef.current = stations;
  selectedIdRef.current = selectedId;
  electricityRef.current = electricity;
  gasRef.current = gas;
  dnoRef.current = dno;
  stationsOnRef.current = stationsOn;

  useEffect(() => {
    return startStaleClock({
      onTick: setNow,
      hidden: () => document.hidden,
      subscribeVisibility(onChange) {
        document.addEventListener("visibilitychange", onChange);
        return () => document.removeEventListener("visibilitychange", onChange);
      },
    });
  }, []);

  function stale(feature: FlowsFeature): boolean {
    if (now === null || !feature.readingAt) {
      return false;
    }
    const threshold = feature.kind === "gas_terminal" ? GAS_STALE_MS : ELECTRICITY_STALE_MS;
    return readingIsStale(feature.readingAt, new Date(now), threshold);
  }

  const electricityStale =
    now !== null &&
    model.electricityLatestAt !== null &&
    readingIsStale(model.electricityLatestAt, new Date(now), ELECTRICITY_BANNER_STALE_MS);
  const gasStale =
    now !== null && model.gasLatestAt !== null && readingIsStale(model.gasLatestAt, new Date(now), GAS_STALE_MS);

  useEffect(() => {
    const element = mapRef.current;
    if (!element) {
      return;
    }
    let disposed = false;
    // CSS stays on this dynamic import. A static import on the page is part of
    // the /map prefetch, and the header link prefetches that route from /.
    void Promise.all([import("@/app/map/maplibre.css"), import("@/lib/map/flows-browser")])
      .then(([, mod]) => {
        if (disposed || !mapRef.current) {
          return;
        }
        handle.current = mod.mountFlowsMap(mapRef.current, {
          lines: drawLinesRef.current(),
          dnoPath: model.dnoPath,
          electricity: electricityRef.current,
          gas: gasRef.current,
          dno: dnoRef.current,
          stations: stationsOnRef.current,
          selectedId: selectedIdRef.current,
          onStatus: (next) => {
            if (!disposed) {
              setStatus(next);
            }
          },
          onSelect: (id) => {
            if (!disposed) {
              chooseRef.current(id, null);
            }
          },
        });
        if (stationsRef.current) {
          handle.current.setStations(stationsRef.current);
        }
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
  }, [model.dnoPath]);

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) {
      return;
    }
    sheet.scrollTop = 0;
  }, [preset]);

  function drawLines() {
    return model.features.map((feature) => ({
      id: feature.id,
      name: feature.name,
      kind: feature.kind,
      width: feature.width,
      value: feature.value,
      direction: feature.direction,
      stale: stale(feature),
      gb: [feature.gbLongitude, feature.gbLatitude] as [number, number],
      remote:
        feature.remoteLongitude !== null && feature.remoteLatitude !== null
          ? ([feature.remoteLongitude, feature.remoteLatitude] as [number, number])
          : null,
    }));
  }

  drawLinesRef.current = drawLines;

  useEffect(() => {
    handle.current?.setLines(drawLines());
    handle.current?.setVisibility({
      electricity,
      gas,
      dno,
      stations: stationsOn,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [electricity, gas, dno, stationsOn, now, model.features]);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      handle.current?.setTheme(documentTheme(document.documentElement));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class", "style"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && (selectedId || about)) {
        event.preventDefault();
        setAbout(false);
        selectedIdRef.current = null;
        setSelectedId(null);
        setStation(null);
        setSnap(140);
        void setUrl({ sel: null });
        focusRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [about, selectedId, setUrl]);

  useEffect(() => {
    const selection = flowSelectionFromQuery({
      sel: url.sel ?? null,
      asset: url.asset ?? null,
      layers: url.layers,
    });
    if (url.layers.length > 0 && layersApplied.current !== url.layers) {
      layersApplied.current = url.layers;
      setElectricity(layerOn(url.layers, "ic"));
    }
    if (!selection.selectedId) {
      return;
    }
    if (!chooseRef.current(selection.selectedId, null, false)) {
      loadStationsRef.current();
    }
  }, [url.sel, url.asset, url.layers, stations, model.features]);

  function choose(id: string, button: HTMLButtonElement | null, syncUrl = true): boolean {
    if (button) {
      focusRef.current = button;
    }
    const feature = model.features.find((item) => item.id === id);
    if (feature) {
      selectedIdRef.current = id;
      setSelectedId(id);
      setStation(null);
      setSnap(430);
      handle.current?.setSelected(id);
      if (syncUrl) {
        switch (feature.kind) {
          case "interconnector":
            void setUrl({ sel: id, layers: withLayer(url.layers, "ic") });
            break;
          case "gas_terminal":
            void setUrl({ sel: id });
            break;
          default: {
            const neverKind: never = feature.kind;
            return neverKind;
          }
        }
      }
      return true;
    }
    const collection = stationsRef.current;
    const match = collection?.features.find((item) => item.properties.id === id);
    if (!collection || !match) {
      return false;
    }
    const group = model.stationGroups.find((item) => item.id === match.properties.group);
    setStation({
      id: match.properties.id,
      name: match.properties.name,
      group: group?.label ?? match.properties.group,
      mw: match.properties.mw,
      href: assetPath(match.properties.id, match.properties.name),
    });
    selectedIdRef.current = id;
    setSelectedId(id);
    setStationsOn(true);
    setSnap(430);
    handle.current?.setStations(collection);
    if (syncUrl) {
      void setUrl({ sel: id });
    }
    return true;
  }

  function applyPreset(next: Preset) {
    setPreset(next);
    if (next === "flows") {
      setElectricity(true);
      setGas(true);
      setStationsOn(false);
      return;
    }
    setElectricity(false);
    setGas(false);
    setStationsOn(true);
    void loadStations();
  }

  function loadStations() {
    if (stations) {
      handle.current?.setStations(stations);
      return;
    }
    void fetch("/api/v1/map/stations")
      .then((response) => {
        if (!response.ok) {
          throw new Error("stations");
        }
        return response.json() as Promise<StationFeatureCollection>;
      })
      .then((body) => {
        setStations(body);
        handle.current?.setStations(body);
      })
      .catch(() => {
        setStations({ type: "FeatureCollection", features: [] });
      });
  }

  chooseRef.current = choose;
  loadStationsRef.current = loadStations;

  const visibleCredits = model.credits.filter((credit) => {
    switch (credit.layer) {
      case "basemap":
        return true;
      case "dno":
        return dno;
      case "electricity":
        return electricity;
      case "gas":
        return gas;
      case "places":
        return electricity || gas;
      case "stations":
        return stationsOn;
      default: {
        const neverLayer: never = credit.layer;
        return neverLayer;
      }
    }
  });

  const announcement = selected
    ? `${selected.name}. ${selected.direction ?? "No direction published"}. ${selected.reading}.`
    : station
      ? `${station.name}. ${station.group}.`
      : "";

  const details =
    preset === "stations" ? (
      station ? (
        <StationDetails station={station} />
      ) : (
        <p className="text-copy-14 text-gray-900">{STATIONS_PANEL_EMPTY}</p>
      )
    ) : selected ? (
      <FlowDetails feature={selected} />
    ) : (
      <p className="text-copy-14 text-gray-900">{FLOWS_PANEL_EMPTY}</p>
    );

  const viewTitle = preset === "stations" ? STATIONS_TITLE : model.title;
  const viewStandfirst = preset === "stations" ? STATIONS_STANDFIRST : model.standfirst;
  const panelLabel = preset === "stations" ? STATIONS_PANEL_LABEL : FLOWS_PANEL_LABEL;

  function Controls({ radioName, title, list }: { radioName: string; title: boolean; list?: ReactNode }) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <div>
          {title ? <h1 className="text-heading-24 text-gray-1000">{viewTitle}</h1> : null}
          <p className="mt-2 text-copy-14 text-gray-900">{viewStandfirst}</p>
          {preset === "flows" ? (
            <p className="mt-2 text-label-13 text-gray-900">
              {model.electricityLatestAt
                ? `Electricity ${londonClock(new Date(model.electricityLatestAt))}`
                : "Electricity —"}
              {model.gasFlows === "published" && model.gasLatestAt
                ? `. Gas ${londonClock(new Date(model.gasLatestAt))}`
                : ""}
            </p>
          ) : null}
        </div>
        {list}
        {model.feed === "unavailable" ? (
          <p className="border-l-2 border-amber-700 pl-3 text-copy-14 text-gray-1000">{FEED_FAILED}</p>
        ) : null}
        {(electricity && electricityStale) || (gas && gasStale) ? (
          <p className="border-l-2 border-amber-700 pl-3 text-copy-14 text-gray-1000">
            {staleCopy(
              londonClock(
                new Date(
                  (electricityStale ? model.electricityLatestAt : model.gasLatestAt) ??
                    model.electricityLatestAt ??
                    model.gasLatestAt ??
                    Date.now(),
                ),
              ),
            )}
          </p>
        ) : null}
        {model.gasFlows === "unavailable" ? (
          <p className="text-copy-14 text-gray-1000">
            {model.gasUnavailable}{" "}
            <Link href="/gas" className="text-blue-700 underline-offset-2 hover:underline">
              Gas page
            </Link>
          </p>
        ) : null}
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="text-label-13 text-gray-900">View</legend>
          {(
            [
              ["flows", "Flows"],
              ["stations", "Power stations"],
            ] as const
          ).map(([id, label]) => (
            <label key={id} className="flex items-center gap-2 text-copy-14 text-gray-1000">
              <input type="radio" name={radioName} checked={preset === id} onChange={() => applyPreset(id)} />
              {label}
            </label>
          ))}
          <label className="flex items-center gap-2 text-copy-14 text-gray-900">
            <input type="radio" name={radioName} disabled />
            Projects
          </label>
          <p className="text-copy-14 text-gray-900">{PROJECTS_LAYER_NOTE}</p>
        </fieldset>
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="text-label-13 text-gray-900">Layers</legend>
          <LayerToggle label="Interconnectors" checked={electricity} onChange={setElectricity} />
          <LayerToggle
            label="Gas entry points"
            checked={gas}
            onChange={(on) => {
              setGas(on);
            }}
          />
          <LayerToggle
            label="Power stations"
            checked={stationsOn}
            onChange={(on) => {
              setStationsOn(on);
              if (on) {
                void loadStations();
              }
            }}
          />
          <LayerToggle label="DNO licence areas" checked={dno} onChange={setDno} />
          <p className="text-copy-14 text-gray-900">{model.straightLine}</p>
          {electricity ? (
            <p className="text-copy-14 text-gray-900">
              <Link href={NI_PATH} className="underline-offset-2 hover:underline">
                {NI_FLOW_NOTE}
              </Link>
            </p>
          ) : null}
        </fieldset>
        {preset === "flows" ? (
          <div>
            <p className="text-label-13 text-gray-900">Line width</p>
            <ul className="mt-1 flex flex-col gap-1">
              {FLOW_WIDTH_KEY.map((step) => (
                <li key={step.width} className="flex items-center gap-2 text-copy-14 text-gray-1000">
                  <span
                    className="inline-block h-0 w-8 border-t border-gray-1000"
                    style={{ borderTopWidth: step.width }}
                  />
                  {step.width === 2 ? "Under 500 MW or under 20 mcm/d" : `${step.electricity}. ${step.gas}`}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {preset === "stations" ? (
          <div>
            <p className="text-label-13 text-gray-900">Station size</p>
            <ul className="mt-1 flex flex-col gap-1">
              {model.stationGroups.map((group) => (
                <li key={group.id} className="flex items-center gap-2 text-copy-14 text-gray-1000">
                  <ShapeMark shape={group.shape} color={group.color} />
                  {group.label}
                </li>
              ))}
              {model.sizeSteps.map((step) => (
                <li key={step.id} className="text-copy-14 text-gray-900">
                  {step.label}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {preset === "flows" ? (
          <>
            <p className="text-copy-14 text-gray-1000">
              {netElectricityLabel(model.netElectricityMw, model.electricityIncluded, model.electricityMissing)}
            </p>
            <p className="text-copy-14 text-gray-1000">
              {netGasLabel(
                model.gasFlows === "published" ? model.netGasMcm : null,
                model.gasFlows === "published" ? model.gasMissing : 0,
              )}
            </p>
          </>
        ) : null}
        <div className="flex min-w-0 flex-col gap-2 text-copy-14 text-gray-900">
          <button
            type="button"
            className="w-fit text-blue-700 underline-offset-2 hover:underline"
            onClick={() => setAbout(true)}
          >
            About these layers
          </button>
          <p>
            <Link href={FLOWS_FALLBACK_HREF} className="text-blue-700 underline-offset-2 hover:underline">
              Flows table
            </Link>
          </p>
          <p>{FLOWS_KEYBOARD}</p>
          <SiteLegalNav />
        </div>
      </div>
    );
  }

  function creditsControl(growSheet: boolean) {
    return (
      <details
        className="relative"
        onToggle={(event) => {
          if (!growSheet || !event.currentTarget.open) {
            return;
          }
          setSnap((current) => (current === FLOW_SHEET_PEEK_PX ? 430 : current));
        }}
      >
        <summary className="w-fit cursor-pointer text-copy-14 text-gray-1000">©</summary>
        <div className="absolute left-0 top-full z-30 mt-2 flex max-h-48 w-[min(18rem,calc(100vw-2rem))] min-w-0 flex-col gap-2 overflow-y-auto rounded-lg border border-gray-alpha-400 bg-background-100 p-3 text-copy-14 break-words text-gray-900">
          {visibleCredits.map((credit) => (
            <p key={credit.id}>{credit.text}</p>
          ))}
          {dno && model.dnoWarning ? <p>{model.dnoWarning}</p> : null}
        </div>
      </details>
    );
  }

  return (
    <div
      data-flows-stage
      className="relative grid h-full min-h-0 min-w-0 grid-cols-1 lg:grid-cols-[20rem_minmax(0,1fr)_340px]"
    >
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <aside className="hidden h-full min-h-0 overflow-y-auto border-r border-gray-alpha-400 bg-background-100 p-4 lg:block">
        <div className="mb-4">{creditsControl(false)}</div>
        <Controls
          radioName="map-view-panel"
          title={desktop}
          list={preset === "flows" ? <FlowList features={model.features} selectedId={selectedId} onSelect={choose} /> : null}
        />
      </aside>
      <div className="relative min-h-0 min-w-0">
        <div
          data-map-frame
          className="absolute inset-0"
          style={
            {
              "--flow-sheet-h": snap === "full" ? "100%" : `${snap}px`,
            } as CSSProperties
          }
        >
          <div ref={mapRef} className="absolute inset-0 h-full w-full" data-map-status={status} />
        </div>
        {status === "loading" ? <Skeleton className="absolute inset-4" /> : null}
        {status === "error" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background-100 p-6">
            <p className="max-w-sm text-copy-16 text-gray-1000">
              {MAP_FAILED}{" "}
              <Link href={FLOWS_FALLBACK_HREF} className="text-blue-700 underline-offset-2 hover:underline">
                Open the flows table
              </Link>
            </p>
          </div>
        ) : null}
      </div>
      <aside
        data-flow-inspector
        className="hidden h-full min-h-0 overflow-y-auto border-l border-gray-alpha-400 bg-background-100 p-4 lg:block"
        aria-label={panelLabel}
      >
        {details}
      </aside>
      <div
        ref={sheetRef}
        data-flow-sheet
        role="dialog"
        aria-labelledby="flow-sheet-title"
        className="absolute inset-x-0 bottom-0 z-10 flex flex-col overflow-y-auto border-t border-gray-alpha-400 bg-background-100 p-4 lg:hidden"
        style={{ height: snap === "full" ? "100%" : snap }}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <p id="flow-sheet-title" className="text-label-13 text-gray-900">
              {panelLabel}
            </p>
            {creditsControl(true)}
          </div>
          <button
            type="button"
            className="text-label-13 text-blue-700"
            onClick={() => setSnap(snap === FLOW_SHEET_PEEK_PX ? 430 : snap === 430 ? "full" : FLOW_SHEET_PEEK_PX)}
          >
            {snap === "full" ? "Collapse" : "Expand"}
          </button>
        </div>
        <Controls
          radioName="map-view-sheet"
          title={!desktop}
          list={preset === "flows" ? <FlowList features={model.features} selectedId={selectedId} onSelect={choose} /> : null}
        />
        <div className="mt-4">{details}</div>
      </div>
      {about ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="about-layers-title"
          className="absolute inset-0 z-20 flex items-end justify-center bg-background-100/80 p-4 sm:items-center"
        >
          <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-xl border border-gray-alpha-400 bg-background-100 p-4">
            <h2 id="about-layers-title" className="text-heading-16 text-gray-1000">
              About these layers
            </h2>
            <div className="mt-3 flex flex-col gap-2 text-copy-14 text-gray-900">
              {model.credits.map((credit) => (
                <p key={credit.id}>{credit.text}</p>
              ))}
              <p>{model.straightLine}</p>
              {model.dnoWarning ? <p>{model.dnoWarning}</p> : null}
              <p>{PROJECTS_LAYER_NOTE}</p>
            </div>
            <button
              type="button"
              className="mt-4 text-blue-700 underline-offset-2 hover:underline"
              onClick={() => setAbout(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LayerToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-copy-14 text-gray-1000">
      <input
        type="checkbox"
        className="size-4"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}
