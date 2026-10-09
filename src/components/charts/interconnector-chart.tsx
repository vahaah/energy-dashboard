"use client";

import type { Generation5min } from "@/lib/types";
import { INTERCONNECTOR_COLORS, INTERCONNECTOR_LABELS } from "@/lib/colors";
import { normalizeFuelType } from "@/lib/dashboard-model";

interface Props {
  data: Generation5min[];
}

export function InterconnectorChart({ data }: Props) {
  const byIC = new Map<string, number>();
  for (const row of data) {
    const interconnector = normalizeFuelType(row.fuel_type);
    byIC.set(interconnector, (byIC.get(interconnector) ?? 0) + row.generation_mw);
  }

  const sorted = Array.from(byIC.entries())
    .map(([ic, mw]) => ({ ic, mw, gw: mw / 1000 }))
    .filter(({ mw }) => Math.abs(mw) >= 25)
    .sort((a, b) => Math.abs(b.mw) - Math.abs(a.mw));

  const netTransfer = sorted.reduce((sum, { mw }) => sum + mw, 0);
  const maxAbsMw = Math.max(...sorted.map((s) => Math.abs(s.mw)), 1);

  return (
    <div className="space-y-2">
      {sorted.map(({ ic, mw, gw }) => {
        const isImport = mw >= 0;
        const barPct = (Math.abs(mw) / maxAbsMw) * 100;

        return (
          <div key={ic} className="flex h-9 items-center gap-3">
            <div className="flex w-36 items-center gap-1.5 text-copy-14 text-gray-1000">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: INTERCONNECTOR_COLORS[ic] ?? "#94a3b8" }}
              />
              {INTERCONNECTOR_LABELS[ic] ?? ic}
            </div>
            <div className="flex flex-1 items-center gap-2">
              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-background-200">
                <div
                  className={`absolute top-0 h-full rounded-full ${isImport ? "left-0" : "right-0"}`}
                  style={{
                    width: `${barPct}%`,
                    backgroundColor: INTERCONNECTOR_COLORS[ic] ?? "#94a3b8",
                  }}
                />
              </div>
              <p className="w-20 text-right font-sans text-copy-14 tabular-nums text-gray-1000">
                {Math.abs(gw).toFixed(2)}
                <span className="text-gray-700"> GW</span>
                <span className="ml-1 text-label-12 text-gray-900">{isImport ? "in" : "out"}</span>
              </p>
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-between border-t border-gray-alpha-400 pt-2 text-copy-14">
        <span className="text-gray-900">Net transfers</span>
        <span className="font-sans tabular-nums text-gray-1000">
          {netTransfer >= 0 ? "+" : ""}
          {(netTransfer / 1000).toFixed(2)} GW
          {netTransfer >= 0 ? " import" : " export"}
        </span>
      </div>
    </div>
  );
}
