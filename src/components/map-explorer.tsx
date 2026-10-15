"use client";

import { useState } from "react";
import { PowerMap } from "@/components/power-map";
import { Card } from "@/components/ui/card";
import {
  ASSET_PRECISION,
  MAP_KEYBOARD_COPY,
  precisionLabel,
  technologyColor,
  technologyLabel,
} from "@/lib/assets/labels";
import type { MapLayerView, MapPoint } from "@/lib/assets/types";
import type { Technology } from "@/lib/catalogue/assets/technologies";
import type { LayerPrecision } from "@/lib/map/precision";

function PrecisionTag({ precision }: { precision: LayerPrecision }) {
  return (
    <span className="inline-flex items-center rounded-md border border-gray-alpha-400 px-1.5 py-0.5 text-label-12 text-gray-900">
      {precisionLabel(precision)}
    </span>
  );
}

export function MapExplorer({
  points,
  basemap,
  dno,
  technologies,
}: {
  points: readonly MapPoint[];
  basemap: MapLayerView;
  dno: MapLayerView;
  technologies: readonly Technology[];
}) {
  const [assetsOn, setAssetsOn] = useState(true);
  const [dnoOn, setDnoOn] = useState(dno.defaultVisible);

  return (
    <Card
      title="Layers"
      footer={
        <div className="flex min-w-0 flex-col gap-2 break-words">
          <p>{basemap.attribution}</p>
          <p>{dno.attribution}</p>
          {dno.accuracyWarning ? <p>{dno.accuracyWarning}</p> : null}
          <p>{MAP_KEYBOARD_COPY}</p>
        </div>
      }
    >
      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="sr-only">Map layers</legend>
        <label className="flex min-w-0 items-start gap-2 text-copy-14 text-gray-1000">
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0"
            checked={assetsOn}
            onChange={(event) => setAssetsOn(event.target.checked)}
          />
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            Power assets
            <PrecisionTag precision={ASSET_PRECISION} />
          </span>
        </label>
        <label className="flex min-w-0 items-start gap-2 text-copy-14 text-gray-1000">
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0"
            checked={dnoOn}
            onChange={(event) => setDnoOn(event.target.checked)}
          />
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            DNO licence areas
            <PrecisionTag precision={dno.precision} />
          </span>
        </label>
        <p className="flex min-w-0 flex-wrap items-center gap-2 text-copy-14 text-gray-1000">
          <span>OS basemap</span>
          <PrecisionTag precision={basemap.precision} />
        </p>
      </fieldset>
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
      <div className="mt-4 min-w-0">
        <PowerMap
          points={points}
          dnoPath={dno.path}
          dnoVisible={dnoOn}
          assetsVisible={assetsOn}
          selectedId={null}
        />
      </div>
    </Card>
  );
}
