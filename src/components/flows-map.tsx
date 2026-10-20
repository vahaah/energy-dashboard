"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { assetPath } from "@/lib/assets/href";
import { NI_FLOW_NOTE } from "@/lib/attribution";
import { NI_PATH } from "@/lib/eirgrid/copy";
import { SiteLegalNav } from "@/components/site-legal-nav";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ELECTRICITY_STALE_MS,
  GAS_STALE_MS,
  netElectricityLabel,
  netGasLabel,
  readingIsStale,
} from "@/lib/map/flow-scale";
import {
  FEED_FAILED,
  FLOWS_FALLBACK_HREF,
  FLOWS_KEYBOARD,
  FLOW_WIDTH_KEY,
  MAP_FAILED,
  PROJECTS_LAYER_NOTE,
  londonClock,
  staleCopy,
} from "@/lib/map/flows-copy";
import type { FlowsFeature, FlowsPageModel } from "@/lib/map/flows-types";
import type { FlowsMapHandle, FlowsMapTheme } from "@/lib/map/flows-browser";
import type { StationFeatureCollection } from "@/lib/map/stations-layer";
import { MAP_SIZE_STEPS, MAP_TECHNOLOGY_GROUPS, type MapShape } from "@/lib/map/symbols";

type Preset = "flows" | "stations";
type Snap = 140 | 430 | "full";

type StationPick = {
  id: string;
  name: string;
  group: string;
  mw: number | null;
  href: string;
};

function themeOf(): FlowsMapTheme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function ShapeMark({ shape }: { shape: MapShape }) {
  const common = "inline-block size-3 shrink-0 border border-gray-1000";
  switch (shape) {
    case "circle":
      return <span className={`${common} rounded-full bg-gray-1000`} />;
    case "diamond":
      return <span className={`${common} rotate-45 bg-gray-1000`} />;
    case "square":
      return <span className={`${common} bg-gray-1000`} />;
    case "triangle":
      return <span className="inline-block size-0 shrink-0 border-x-[6px] border-b-[10px] border-x-transparent border-b-gray-1000" />;
    case "hexagon":
      return <span className={`${common} bg-gray-1000 [clip-path:polygon(25%_0,75%_0,100%_50%,75%_100%,25%_100%,0_50%)]`} />;
    case "plus":
      return <span className="inline-block shrink-0 text-label-12 text-gray-1000">+</span>;
    case "ring":
      return <span className={`${common} rounded-full`} />;
    case "pill":
      return <span className={`${common} h-2 w-3 rounded-full bg-gray-1000`} />;
    case "bar":
      return <span className={`${common} h-1.5 w-3 bg-gray-1000`} />;
    default: {
      const neverShape: never = shape;
      return neverShape;
    }
  }
}

function Sparkline({ values }: { values: (number | null)[] | null }) {
  const points = values?.filter((value): value is number => value !== null) ?? [];
  if (!values || points.length === 0) {
    return <p className="text-copy-14 text-gray-900">—</p>;
  }
  const width = 220;
  const height = 36;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  let path = "";
  values.forEach((value, index) => {
    if (value === null) {
      return;
    }
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - ((value - min) / span) * (height - 2) - 1;
    path += path.length === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-9 w-full" role="img" aria-label="24 hour reading">
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
  const group = MAP_TECHNOLOGY_GROUPS.find((item) => item.id === station.group);
  return (
    <div className="flex min-w-0 flex-col gap-3 break-words">
      <h2 className="text-heading-16 text-gray-1000">{station.name}</h2>
      <p className="text-copy-14 text-gray-1000">{group?.label ?? station.group}</p>
      <p className="text-copy-14 text-gray-1000">
        Rated power: {station.mw === null ? "—" : `${station.mw.toLocaleString("en-GB")} MW`}
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
              <span className="text-label-12 text-gray-900">
                {feature.direction ?? "—"} · {feature.reading}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function FlowsMap({ model }: { model: FlowsPageModel }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const handle = useRef<FlowsMapHandle | null>(null);
  const focusRef = useRef<HTMLButtonElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [preset, setPreset] = useState<Preset>("flows");
  const [electricity, setElectricity] = useState(true);
  const [gas, setGas] = useState(true);
  const [stationsOn, setStationsOn] = useState(false);
  const [dno, setDno] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [station, setStation] = useState<StationPick | null>(null);
  const [stations, setStations] = useState<StationFeatureCollection | null>(null);
  const [snap, setSnap] = useState<Snap>(140);
  const [about, setAbout] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  const selected = model.features.find((feature) => feature.id === selectedId) ?? null;

  useEffect(() => {
    setNow(Date.now());
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
    readingIsStale(model.electricityLatestAt, new Date(now), ELECTRICITY_STALE_MS);
  const gasStale =
    now !== null && model.gasLatestAt !== null && readingIsStale(model.gasLatestAt, new Date(now), GAS_STALE_MS);

  useEffect(() => {
    const element = mapRef.current;
    const overlay = overlayRef.current;
    if (!element || !overlay) {
      return;
    }
    let disposed = false;
    void import("@/lib/map/flows-browser")
      .then((mod) => {
        if (disposed || !mapRef.current || !overlayRef.current) {
          return;
        }
        handle.current = mod.mountFlowsMap(mapRef.current, overlayRef.current, {
          lines: drawLines(),
          dnoPath: model.dnoPath,
          electricity: true,
          gas: true,
          dno: false,
          stations: false,
          selectedId: null,
          onStatus: (next) => {
            if (!disposed) {
              setStatus(next);
            }
          },
          onSelect: (id) => {
            if (!disposed) {
              choose(id, null);
            }
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
    // Mount once. Later effects push updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.dnoPath]);

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

  useEffect(() => {
    handle.current?.setLines(drawLines());
    handle.current?.setVisibility({ electricity, gas, dno, stations: stationsOn });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [electricity, gas, dno, stationsOn, now, model.features]);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      handle.current?.setTheme(themeOf());
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && (selectedId || about)) {
        event.preventDefault();
        setAbout(false);
        setSelectedId(null);
        setStation(null);
        setSnap(140);
        focusRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [about, selectedId]);

  function choose(id: string, button: HTMLButtonElement | null) {
    if (button) {
      focusRef.current = button;
    }
    const feature = model.features.find((item) => item.id === id);
    if (feature) {
      setSelectedId(id);
      setStation(null);
      setSnap(430);
      handle.current?.setSelected(id);
      return;
    }
    const match = stations?.features.find((feature) => feature.properties.id === id);
    if (!match) {
      return;
    }
    const group = MAP_TECHNOLOGY_GROUPS.find((item) => item.id === match.properties.group);
    setStation({
      id: match.properties.id,
      name: match.properties.name,
      group: group?.label ?? match.properties.group,
      mw: match.properties.mw,
      href: assetPath(match.properties.id, match.properties.name),
    });
    setSelectedId(id);
    setSnap(430);
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

  const details = selected ? (
    <FlowDetails feature={selected} />
  ) : station ? (
    <StationDetails station={station} />
  ) : (
    <p className="text-copy-14 text-gray-900">Select a flow from the list.</p>
  );

  function Controls() {
    return (
    <div className="flex min-w-0 flex-col gap-4">
      <div>
        <h1 className="text-heading-24 text-gray-1000">{model.title}</h1>
        <p className="mt-2 text-copy-14 text-gray-900">{model.standfirst}</p>
        <p className="mt-2 text-label-13 text-gray-900">
          {model.electricityLatestAt ? `Electricity ${londonClock(new Date(model.electricityLatestAt))}` : "Electricity —"}
          {model.gasFlows === "published" && model.gasLatestAt
            ? `. Gas ${londonClock(new Date(model.gasLatestAt))}`
            : ""}
        </p>
      </div>
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
            <input
              type="radio"
              name="map-preset"
              checked={preset === id}
              onChange={() => applyPreset(id)}
            />
            {label}
          </label>
        ))}
        <label className="flex items-center gap-2 text-copy-14 text-gray-900">
          <input type="radio" name="map-preset" disabled />
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
      <div>
        <p className="text-label-13 text-gray-900">Line width</p>
        <ul className="mt-1 flex flex-col gap-1">
          {FLOW_WIDTH_KEY.map((step) => (
            <li key={step.width} className="flex items-center gap-2 text-copy-14 text-gray-1000">
              <span className="inline-block h-0 w-8 border-t border-gray-1000" style={{ borderTopWidth: step.width }} />
              {step.electricity}. {step.gas}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-label-13 text-gray-900">Station size</p>
        <ul className="mt-1 flex flex-col gap-1">
          {MAP_TECHNOLOGY_GROUPS.map((group) => (
            <li key={group.id} className="flex items-center gap-2 text-copy-14 text-gray-1000">
              <ShapeMark shape={group.shape} />
              {group.label}
            </li>
          ))}
          {MAP_SIZE_STEPS.map((step) => (
            <li key={step.id} className="text-copy-14 text-gray-900">
              {step.label}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-copy-14 text-gray-1000">
        {netElectricityLabel(model.netElectricityMw, model.electricityIncluded, model.electricityMissing)}
      </p>
      <p className="text-copy-14 text-gray-1000">{netGasLabel(model.gasFlows === "published" ? model.netGasMcm : null)}</p>
      <div className="flex min-w-0 flex-col gap-2 text-copy-14 text-gray-900">
        {visibleCredits.map((credit) => (
          <p key={credit.id}>{credit.text}</p>
        ))}
        {dno && model.dnoWarning ? <p>{model.dnoWarning}</p> : null}
        <button type="button" className="w-fit text-blue-700 underline-offset-2 hover:underline" onClick={() => setAbout(true)}>
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

  return (
    <div data-flows-stage className="relative flex h-full min-h-0 min-w-0">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <aside className="hidden h-full w-80 shrink-0 overflow-y-auto border-r border-gray-alpha-400 bg-background-100 p-4 lg:block">
        {Controls()}
        <FlowList features={model.features} selectedId={selectedId} onSelect={choose} />
      </aside>
      <div className="relative min-h-0 min-w-0 flex-1">
        <div ref={mapRef} className="absolute inset-0" data-map-status={status} />
        <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
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
        className="hidden h-full w-[340px] shrink-0 overflow-y-auto border-l border-gray-alpha-400 bg-background-100 p-4 lg:block"
        aria-label="Flow details"
      >
        {details}
      </aside>
      <div
        data-flow-sheet
        role="dialog"
        aria-labelledby="flow-sheet-title"
        className="absolute inset-x-0 bottom-0 z-10 flex flex-col overflow-y-auto border-t border-gray-alpha-400 bg-background-100 p-4 lg:hidden"
        style={{ height: snap === "full" ? "100%" : snap }}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <p id="flow-sheet-title" className="text-label-13 text-gray-900">
            Flow details
          </p>
          <button
            type="button"
            className="text-label-13 text-blue-700"
            onClick={() => setSnap(snap === 140 ? 430 : snap === 430 ? "full" : 140)}
          >
            {snap === "full" ? "Collapse" : "Expand"}
          </button>
        </div>
        {Controls()}
        <FlowList features={model.features} selectedId={selectedId} onSelect={choose} />
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
            <button type="button" className="mt-4 text-blue-700 underline-offset-2 hover:underline" onClick={() => setAbout(false)}>
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
      <input type="checkbox" className="size-4" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}
