"use client";

import { fuelColor, fuelLabel } from "@/lib/colors";
import type { NowBySourceView } from "@/lib/generation-desk-view";

interface Props {
  view: NowBySourceView;
}

export function GenerationNowCard({ view }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-gray-200"
        role="img"
        aria-label="Share of domestic generation"
      >
        {view.stacked.map((segment) => (
          <span
            key={segment.fuel}
            className="h-full"
            style={{
              width: `${segment.pct}%`,
              backgroundColor: fuelColor(segment.fuel),
            }}
            title={`${fuelLabel(segment.fuel)} ${segment.pct.toFixed(1)}%`}
          />
        ))}
      </div>

      <ul className="flex flex-col gap-3">
        {view.rows.map((row) => (
          <li key={row.fuel} className="flex flex-col gap-1.5 sm:grid sm:grid-cols-[minmax(0,1.5fr)_4.5rem_4.5rem_minmax(3.5rem,1fr)] sm:items-center sm:gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: fuelColor(row.fuel) }}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-1000">{fuelLabel(row.fuel)}</p>
                {row.missingNote ? (
                  <p className="text-xs text-gray-900">{row.missingNote}</p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-3 pl-5 sm:contents">
              <p className="min-w-[4.5rem] text-right font-sans text-sm tabular-nums text-gray-1000">
                {row.gwLabel}
                {row.mw != null ? <span className="ml-1 text-xs text-gray-900">GW</span> : null}
              </p>
              <p className="min-w-[4.5rem] text-right font-sans text-sm tabular-nums text-gray-900">
                {row.demandPctLabel}
              </p>
              <div className="h-1.5 min-w-0 flex-1 rounded-full bg-gray-200">
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    width: `${row.barPct}%`,
                    backgroundColor: fuelColor(row.fuel),
                  }}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-1 gap-1 border-t border-gray-alpha-400 pt-3 text-sm font-medium text-gray-1000 sm:grid-cols-[minmax(0,1.5fr)_4.5rem_4.5rem_minmax(3.5rem,1fr)] sm:items-center sm:gap-3">
        <p>Domestic total</p>
        <p className="text-right font-sans tabular-nums">
          {view.totalGwLabel}
          <span className="ml-1 text-xs font-normal text-gray-900">GW</span>
        </p>
        <p className="text-right font-sans tabular-nums text-gray-900">{view.totalDemandPctLabel}</p>
        <span className="hidden sm:block" />
      </div>
    </div>
  );
}
