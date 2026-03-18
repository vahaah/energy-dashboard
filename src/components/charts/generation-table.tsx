"use client";

import type { Generation5min } from "@/lib/types";
import { FUELINST_COLORS, FUELINST_LABELS } from "@/lib/colors";

interface Props {
  data: Generation5min[];
  demandMw?: number;
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
    .sort((a, b) => b.mw - a.mw);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
            <th className="pb-2 font-medium">Source</th>
            <th className="pb-2 font-medium text-right">GW</th>
            <th className="pb-2 font-medium text-right">% of Demand</th>
            <th className="pb-2 font-medium w-32"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ fuel, gw, pct }) => (
            <tr key={fuel} className="border-b border-zinc-100 dark:border-zinc-800/50">
              <td className="py-2 flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: FUELINST_COLORS[fuel] ?? "#94a3b8" }}
                />
                <span className="text-zinc-700 dark:text-zinc-300">
                  {FUELINST_LABELS[fuel] ?? fuel.toUpperCase()}
                </span>
              </td>
              <td className="py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                {gw.toFixed(1)}
              </td>
              <td className="py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                {pct.toFixed(1)}%
              </td>
              <td className="py-2 pl-3">
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full transition-all"
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
          <tr className="text-xs text-zinc-500 dark:text-zinc-400">
            <td className="pt-2 font-medium">Total</td>
            <td className="pt-2 text-right font-medium tabular-nums">
              {(totalGen / 1000).toFixed(1)}
            </td>
            <td className="pt-2 text-right font-medium tabular-nums">
              {demand > 0 ? ((totalGen / demand) * 100).toFixed(1) : "—"}%
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
