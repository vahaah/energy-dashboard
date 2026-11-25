"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQueryStates } from "nuqs";
import { PowerMap } from "@/components/power-map";
import { Card } from "@/components/ui/card";
import { ChoiceSelect } from "@/components/ui/choice-select";
import { NamedCheckbox } from "@/components/ui/named-checkbox";
import { assetHref } from "@/lib/assets/href";
import {
  ASSET_PRECISION,
  MAP_KEYBOARD_COPY,
  formatMw,
  precisionLabel,
  technologyColor,
  technologyLabel,
} from "@/lib/assets/labels";
import { mapViewParsers } from "@/lib/assets/params";
import { matchingAssets } from "@/lib/assets/query";
import {
  ASSET_SOURCES,
  isAssetSource,
  isAssetTechnology,
  type AssetIndexRow,
  type AssetTechnology,
  type MapLayerView,
  type MapPoint,
} from "@/lib/assets/types";
import { SCHEMATIC_LINK_LABEL } from "@/lib/catalogue/links/schema";
import { mapCounts, type MapBounds } from "@/lib/map/counts";
import type { InterconnectorLine } from "@/lib/map/interconnector-layer";
import type { LayerPrecision } from "@/lib/map/precision";

function PrecisionTag({ precision }: { precision: LayerPrecision }) {
  return (
    <span className="inline-flex items-center rounded-md border border-gray-alpha-400 px-1.5 py-0.5 text-label-12 text-gray-900">
      {precisionLabel(precision)}
    </span>
  );
}

function layerOn(layers: string, token: string): boolean {
  return layers.split(",").filter((part) => part.length > 0).includes(token);
}

export function MapExplorer({
  rows,
  points,
  lines,
  basemap,
  dno,
  technologies,
  elexonAttribution,
  nationalGasAttribution,
  regions,
}: {
  rows: readonly AssetIndexRow[];
  points: readonly MapPoint[];
  lines: readonly InterconnectorLine[];
  basemap: MapLayerView;
  dno: MapLayerView;
  technologies: readonly AssetTechnology[];
  elexonAttribution: string;
  nationalGasAttribution: string;
  regions: readonly string[];
}) {
  const [url, setUrl] = useQueryStates(mapViewParsers, { history: "replace", shallow: true, scroll: false });
  const [assetsOn, setAssetsOn] = useState(true);
  const [dnoOn, setDnoOn] = useState(dno.defaultVisible);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const icOn = layerOn(url.layers, "ic");
  const selectedId = url.sel ?? url.asset ?? null;
  const matched = useMemo(
    () =>
      matchingAssets(rows, {
        q: url.q,
        technology: url.technology,
        status: url.status,
        source: url.source,
        region: url.region,
        sort: url.sort,
        dir: url.dir,
        page: 1,
        pageSize: 1,
      }),
    [rows, url.q, url.technology, url.status, url.source, url.region, url.sort, url.dir],
  );
  const lineById = useMemo(() => new Map(lines.map((line) => [line.id, line])), [lines]);
  const counts = mapCounts(
    matched.map((row) => {
      const line = lineById.get(row.id);
      return {
        id: row.id,
        latitude: row.latitude,
        longitude: row.longitude,
        line: line
          ? {
              gbLongitude: line.gbLongitude,
              gbLatitude: line.gbLatitude,
              remoteLongitude: line.remoteLongitude,
              remoteLatitude: line.remoteLatitude,
            }
          : null,
      };
    }),
    bounds,
  );
  const matchedIds = useMemo(() => new Set(matched.map((row) => row.id)), [matched]);
  const visiblePoints = useMemo(() => points.filter((point) => matchedIds.has(point.id)), [points, matchedIds]);
  const visibleLines = useMemo(() => lines.filter((line) => matchedIds.has(line.id)), [lines, matchedIds]);
  const selected = selectedId ? rows.find((row) => row.id === selectedId) : undefined;
  const technologiesInRows = technologies.filter((technology) => rows.some((row) => row.technology === technology));

  function setIc(on: boolean) {
    const tokens = new Set(url.layers.split(",").filter((part) => part.length > 0));
    if (on) {
      tokens.add("ic");
    } else {
      tokens.delete("ic");
    }
    void setUrl({ layers: [...tokens].join(",") });
  }

  return (
    <Card
      title="Layers"
      footer={
        <div className="flex min-w-0 flex-col gap-2 break-words">
          <p>{basemap.attribution}</p>
          <p>{dno.attribution}</p>
          <p>{elexonAttribution}</p>
          <p>{nationalGasAttribution}</p>
          {dno.accuracyWarning ? <p>{dno.accuracyWarning}</p> : null}
          <p>{MAP_KEYBOARD_COPY}</p>
        </div>
      }
    >
      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="sr-only">Map layers</legend>
        <NamedCheckbox name="power-assets" label="Power assets" checked={assetsOn} onCheckedChange={setAssetsOn}>
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            Power assets
            <PrecisionTag precision={ASSET_PRECISION} />
          </span>
        </NamedCheckbox>
        <NamedCheckbox name="interconnectors" label="Interconnectors" checked={icOn} onCheckedChange={setIc}>
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            Interconnectors
            <PrecisionTag precision="schematic" />
          </span>
        </NamedCheckbox>
        <p className="break-words text-copy-14 text-gray-900">{SCHEMATIC_LINK_LABEL}</p>
        <NamedCheckbox name="dno" label="DNO licence areas" checked={dnoOn} onCheckedChange={setDnoOn}>
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            DNO licence areas
            <PrecisionTag precision={dno.precision} />
          </span>
        </NamedCheckbox>
        <p className="flex min-w-0 flex-wrap items-center gap-2 text-copy-14 text-gray-1000">
          <span>OS basemap</span>
          <PrecisionTag precision={basemap.precision} />
        </p>
      </fieldset>
      <form className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
        <label className="flex min-w-0 flex-col gap-1 text-label-13 text-gray-900 sm:col-span-2">
          Filter
          <input
            type="search"
            name="q"
            autoComplete="off"
            spellCheck={false}
            value={url.q}
            placeholder="Name, operator, technology, or location…"
            onChange={(event) => void setUrl({ q: event.target.value, page: 1 })}
            className="h-11 w-full min-w-0 rounded-md border border-gray-alpha-400 bg-background-100 px-3 text-copy-16 text-gray-1000"
          />
        </label>
        <FilterSelect
          label="Technology"
          value={url.technology ?? ""}
          onChange={(value) => void setUrl({ technology: isAssetTechnology(value) ? value : null, page: 1 })}
          options={technologiesInRows.map((technology) => ({ value: technology, label: technologyLabel(technology) }))}
        />
        <FilterSelect
          label="Source"
          value={url.source ?? ""}
          onChange={(value) => void setUrl({ source: isAssetSource(value) ? value : null, page: 1 })}
          options={ASSET_SOURCES.map((source) => ({ value: source, label: source }))}
        />
        <FilterSelect
          label="Region"
          value={url.region}
          onChange={(value) => void setUrl({ region: value, page: 1 })}
          options={regions.map((region) => ({ value: region, label: region }))}
        />
      </form>
      <p data-map-counts className="mt-4 break-words text-label-13 text-gray-900">
        {counts.line}
      </p>
      <ul className="mt-4 flex min-w-0 flex-wrap gap-x-3 gap-y-2" aria-label="Technology colours">
        {technologies.map((technology) => (
          <li key={technology} className="flex items-center gap-2 text-label-12 text-gray-900">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: technologyColor(technology) }}
              aria-hidden="true"
            />
            {technologyLabel(technology)}
          </li>
        ))}
      </ul>
      {selected ? (
        <div data-map-inspector className="mt-4 min-w-0 border-t border-gray-alpha-400 pt-4">
          <p className="break-words text-copy-16 text-gray-1000">{selected.name}</p>
          <p className="mt-1 break-words text-copy-14 text-gray-900">
            {technologyLabel(selected.technology)} · {formatMw(selected.mw)} · {selected.region}
          </p>
          <p className="mt-2">
            <Link href={assetHref(selected)} className="text-blue-700 underline-offset-2 hover:underline">
              Asset page →
            </Link>
          </p>
        </div>
      ) : null}
      <div className="mt-4 min-w-0">
        <PowerMap
          points={visiblePoints}
          lines={visibleLines}
          dnoPath={dno.path}
          dnoVisible={dnoOn}
          assetsVisible={assetsOn}
          linesVisible={icOn}
          selectedId={selectedId}
          onSelect={(id) => void setUrl({ sel: id })}
          onView={setBounds}
        />
      </div>
    </Card>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <ChoiceSelect
      label={label}
      name={label.toLowerCase()}
      value={value}
      onValueChange={onChange}
      options={[{ value: "", label: "All" }, ...options]}
    />
  );
}
