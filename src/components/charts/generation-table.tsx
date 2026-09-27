"use client";

import type { Generation5min } from "@/lib/types";
import { FUELINST_COLORS, FUELINST_LABELS } from "@/lib/colors";

interface Props {
  data: Generation5min[];
  demandMw?: number | null;
}

export function GenerationTable({ data, demandMw }: Props) {
  // Aggregate by fuel_type (latest snapshot may have multiple rows per type from different sources)
  const byFuel = new Map<string, number>();
  for (const row of data) {
    byFuel.set(row.fuel_type, (byFuel.get(row.fuel_type) ?? 0) + row.generation_mw);
  }

  const totalGen = Array.from(byFuel.values()).reduce((a, b) => a + b, 0);
  const demand = demandMw ?? totalGen;

  const sorted = Array.from(byFuel.entries())
    .map(([fuel, mw]) => ({
      fuel,
      mw,
      gw: mw / 1000,
      pct: demand > 0 ? (mw / demand) * 100 : 0,
    }))
    .filter(({ mw }) => Math.abs(mw) >= 25)
    .sort((a, b) => b.mw - a.mw);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-alpha-400 text-left text-xs text-gray-900">
            <th className="pb-2 font-medium">Source</th>
            <th className="pb-2 text-right font-medium">GW</th>
            <th className="pb-2 text-right font-medium">% of Demand</th>
            <th className="w-32 pb-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ fuel, gw, pct }) => (
            <tr key={fuel} className="border-b border-gray-alpha-400">
              <td className="flex items-center gap-2 py-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: FUELINST_COLORS[fuel] ?? "#94a3b8" }}
                />
                <span className="text-gray-1000">
                  {FUELINST_LABELS[fuel] ?? fuel.toUpperCase()}
                </span>
              </td>
              <td className="py-2 text-right font-mono tabular-nums text-gray-900">
                {gw.toFixed(1)}
              </td>
              <td className="py-2 text-right font-mono tabular-nums text-gray-900">
                {pct.toFixed(1)}%
              </td>
              <td className="py-2 pl-3">
                <div className="h-1.5 w-full rounded-full bg-gray-200">
                  <div
                    className="h-1.5 rounded-full motion-reduce:transition-none"
                    style={{
                      width: `${Math.min(100, pct)}%`,
                      backgroundColor: FUELINST_COLORS[fuel] ?? "#94a3b8",
                    }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-xs text-gray-900">
            <td className="pt-2 font-medium">Total</td>
            <td className="pt-2 text-right font-medium font-mono tabular-nums">
              {(totalGen / 1000).toFixed(1)}
            </td>
            <td className="pt-2 text-right font-medium font-mono tabular-nums">
              {demand > 0 ? ((totalGen / demand) * 100).toFixed(1) : "—"}%
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
