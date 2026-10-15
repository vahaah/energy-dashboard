"use client";

import { useState } from "react";
import { WHOLE_ENERGY_SECTORS, type WholeEnergySectorId } from "@/lib/whole-energy/copy";

type SectorFuel = {
  column: string;
  label: string;
  text: string;
  value: number;
};

export type SectorPanel = {
  id: WholeEnergySectorId;
  label: string;
  note: string;
  totalText: string;
  shareText: string;
  fuels: SectorFuel[];
};

export function SectorSwitch({ sectors }: { sectors: readonly SectorPanel[] }) {
  const [selected, setSelected] = useState<WholeEnergySectorId>("homes");
  return (
    <div>
      <div
        className="inline-flex max-w-full flex-wrap rounded-md border border-gray-alpha-400 bg-background-200"
        role="group"
        aria-label="Final consumption"
      >
        {WHOLE_ENERGY_SECTORS.map((id) => {
          const sector = sectors.find((item) => item.id === id);
          if (!sector) {
            return null;
          }
          const pressed = id === selected;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={pressed}
              onClick={() => setSelected(id)}
              className={`inline-flex h-8 items-center rounded-md px-2 text-label-13 ${
                pressed ? "bg-background-100 text-gray-1000" : "text-gray-900"
              }`}
            >
              {sector.label}
            </button>
          );
        })}
      </div>
      {sectors.map((sector) => (
        <div key={sector.id} className={sector.id === selected ? "mt-4" : "hidden"} data-sector={sector.id}>
          <p data-figure className="whitespace-nowrap font-sans text-heading-24 tabular-nums text-gray-1000">
            <span data-value>{sector.totalText}</span>
            <span data-unit="TWh" className="ml-2 align-baseline text-copy-14 text-gray-900">
              TWh
            </span>
          </p>
          <p className="mt-1 text-copy-14 text-gray-900" data-share-base="final consumption">
            {sector.shareText}
          </p>
          <p className="mt-2 text-copy-14 text-gray-900">{sector.note}</p>
          <ul className="mt-4 flex flex-col gap-2">
            {sector.fuels.map((fuel) => (
              <li key={fuel.column} className="flex min-w-0 items-baseline justify-between gap-3 text-copy-14">
                <span className="min-w-0 break-words text-gray-900">{fuel.label}</span>
                <span className="shrink-0 tabular-nums text-gray-1000">{fuel.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
