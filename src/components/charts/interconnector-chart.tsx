"use client";

import type { Generation5min } from "@/lib/types";
import { INTERCONNECTOR_COLORS, INTERCONNECTOR_LABELS } from "@/lib/colors";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { normalizeFuelType } from "@/lib/dashboard-model";

interface Props {
  data: Generation5min[];
}

export function InterconnectorChart({ data }: Props) {
  // Aggregate by interconnector (data is pre-filtered to INT* types)
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
    <div className="space-y-3">
      <div className="space-y-2">
        {sorted.map(({ ic, mw, gw }) => {
          const isImport = mw >= 0;
          const barPct = (Math.abs(mw) / maxAbsMw) * 100;

          return (
            <div key={ic} className="flex items-center gap-3">
              <div className="flex w-36 items-center gap-1.5 text-sm text-gray-900">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: INTERCONNECTOR_COLORS[ic] ?? "#94a3b8" }}
                />
                {INTERCONNECTOR_LABELS[ic] ?? ic}
              </div>
              <div className="flex-1 flex items-center gap-2">
                <div className="relative h-4 flex-1 overflow-hidden rounded bg-gray-200">
                  <div
                    className={`absolute top-0 h-full rounded ${
                      isImport ? "left-0" : "right-0"
                    }`}
                    style={{
                      width: `${barPct}%`,
                      backgroundColor: INTERCONNECTOR_COLORS[ic] ?? "#94a3b8",
                      opacity: 0.7,
                    }}
                  />
                </div>
                <div className="flex w-20 items-center justify-end gap-1 text-right font-mono text-sm tabular-nums text-gray-1000">
                  {isImport ? (
                    <ArrowDownLeft className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <ArrowUpRight className="w-3 h-3 text-rose-500" />
                  )}
                  {Math.abs(gw).toFixed(2)} GW
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-gray-alpha-400 pt-2 text-sm">
        <span className="text-gray-900">Net Transfers</span>
        <span className={`font-medium tabular-nums ${netTransfer >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
          {netTransfer >= 0 ? "+" : ""}{(netTransfer / 1000).toFixed(2)} GW
          {netTransfer >= 0 ? " import" : " export"}
        </span>
      </div>
    </div>
  );
}
