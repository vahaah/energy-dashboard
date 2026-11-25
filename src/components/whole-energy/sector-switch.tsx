"use client";

import { parseAsStringLiteral, useQueryStates } from "nuqs";
import { ChoiceRow } from "@/components/ui/choice-row";
import { displayedPercents } from "@/lib/display-rounding";
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

const sectorParsers = {
  sector: parseAsStringLiteral(WHOLE_ENERGY_SECTORS).withDefault("homes"),
};

export function SectorSwitch({ sectors }: { sectors: readonly SectorPanel[] }) {
  const [params, setParams] = useQueryStates(sectorParsers, { history: "replace", shallow: true, scroll: false });
  const selected = params.sector;
  const options = WHOLE_ENERGY_SECTORS.flatMap((id) => {
    const sector = sectors.find((item) => item.id === id);
    return sector ? [{ value: id, label: sector.label }] : [];
  });
  return (
    <div>
      <ChoiceRow
        ariaLabel="Final consumption"
        value={selected}
        onChange={(sector) => {
          void setParams({ sector });
        }}
        options={options}
      />
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
          <ul className="mt-4 flex flex-col gap-3">
            {sectorShares(sector.fuels).map(({ fuel, width, share }) => {
              return (
                <li key={fuel.column} className="min-w-0">
                  <span className="flex items-baseline justify-between gap-3 text-copy-14">
                    <span className="min-w-0 break-words text-gray-900">{fuel.label}</span>
                    <span className="shrink-0 tabular-nums text-gray-1000">
                      {fuel.text} · {share}%
                    </span>
                  </span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-gray-200" aria-hidden="true">
                    <span className="block h-full rounded-full" style={{ width: `${width}%`, backgroundColor: "var(--chart-gas)" }} />
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function sectorShares(fuels: readonly SectorFuel[]): { fuel: SectorFuel; width: number; share: number }[] {
  const magnitudes = fuels.map((fuel) => Math.abs(fuel.value));
  const max = Math.max(0, ...magnitudes);
  const total = magnitudes.reduce((sum, value) => sum + value, 0);
  const shares =
    total > 0 ? displayedPercents(magnitudes.map((value) => (value / total) * 100)) : magnitudes.map(() => 0);
  return fuels.map((fuel, index) => ({
    fuel,
    width: max > 0 ? (Math.abs(fuel.value) / max) * 100 : 0,
    share: shares[index] ?? 0,
  }));
}
