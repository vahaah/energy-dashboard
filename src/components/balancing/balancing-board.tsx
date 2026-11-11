"use client";

import { useState } from "react";
import { DailyCostChart } from "@/components/balancing/daily-cost-chart";
import { MonthlyCostChart } from "@/components/balancing/monthly-cost-chart";
import { TradeChart, tradeChartRows } from "@/components/balancing/trade-chart";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { Card } from "@/components/ui/card";
import { TableScroll } from "@/components/ui/table-scroll";
import { compareCountries } from "@/lib/balancing/countries";
import { TRADE_ESTIMATE_BADGE, TRADE_LABEL, TRADE_TITLE } from "@/lib/balancing/copy";
import { formatGwh, formatPounds } from "@/lib/balancing/money";
import { dailySeries, monthlySeries, tradeCountryTotals, tradeInRange, tradeNet, type BalancingPageModel } from "@/lib/balancing/page-model";
import { netTradePence } from "@/lib/balancing/aggregate";
import { BALANCING_RANGES, type BalancingRange } from "@/lib/balancing/types";

const RANGE_OPTIONS: ReadonlyArray<{ value: BalancingRange; label: string }> = [
  { value: "90d", label: "90d" },
  { value: "1y", label: "1y" },
  { value: "fy", label: "FY" },
  { value: "all", label: "All" },
];

function isRange(value: string): value is BalancingRange {
  return (BALANCING_RANGES as readonly string[]).includes(value);
}

export function BalancingBoard({ model }: { model: BalancingPageModel }) {
  const [range, setRange] = useState<BalancingRange>("90d");
  const daily = dailySeries(model, range);
  const monthly = monthlySeries(model, range);
  const months = tradeInRange(model, range);
  const countries = tradeCountryTotals(months).sort((left, right) => compareCountries(left.country, right.country));
  const net = tradeNet(months);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="min-w-0 overflow-x-auto">
        <TimeRangeSelector
          value={range}
          onChange={(next) => {
            if (isRange(next)) {
              setRange(next);
            }
          }}
          options={RANGE_OPTIONS}
          ariaLabel="Balancing range"
        />
      </div>
      <Card title="Daily balancing cost">
        <p className="break-words text-copy-14 text-gray-900">
          Six NESO categories. Negative categories sit below zero. A missing day is a gap, not zero. A day with fewer
          settlement periods than the clock is provisional.
        </p>
        {range === "all" ? (
          <p className="mt-2 break-words text-copy-14 text-gray-900">
            Daily bars show this financial year. Earlier years are in the monthly chart.
          </p>
        ) : null}
        <div className="mt-4 min-w-0">
          <DailyCostChart points={daily} />
        </div>
      </Card>
      <Card title="Monthly cost, constraints and everything else">
        <p className="break-words text-copy-14 text-gray-900">
          Constraints against the other five categories. The dashed line is the final BSUoS tariff in force at the start
          of the month, in £/MWh, on its own axis.
        </p>
        <div className="mt-4 min-w-0">
          <MonthlyCostChart points={monthly} />
        </div>
      </Card>
      <Card
        title={TRADE_TITLE}
        actions={
          <span className="inline-flex h-6 items-center rounded-md border border-gray-alpha-400 px-2 text-label-12 text-gray-900">
            {TRADE_ESTIMATE_BADGE}
          </span>
        }
      >
        <p className="break-words text-copy-14 text-gray-900">{TRADE_LABEL}</p>
        <p className="mt-2 break-words text-copy-14 tabular-nums text-gray-1000">
          Imports {formatPounds(net.importPence)} · Exports {formatPounds(net.exportPence)} · Net {formatPounds(net.netPence)}
        </p>
        <div className="mt-4 min-w-0">
          <TradeChart rows={tradeChartRows(months)} />
        </div>
        <div className="mt-4 min-w-0">
          <TableScroll>
            <table className="w-full min-w-[36rem] text-left text-copy-14">
              <thead>
                <tr className="text-label-12 text-gray-900">
                  <th className="py-2 pr-3 font-normal">Country</th>
                  <th className="py-2 pr-3 font-normal">Imports</th>
                  <th className="py-2 pr-3 font-normal">Exports</th>
                  <th className="py-2 pr-3 font-normal">Net</th>
                  <th className="py-2 font-normal">Energy</th>
                </tr>
              </thead>
              <tbody>
                {countries.map((country) => (
                  <tr key={country.country} className="border-t border-gray-alpha-400">
                    <th className="py-2 pr-3 text-left font-normal break-words text-gray-1000">{country.country}</th>
                    <td className="py-2 pr-3 tabular-nums text-gray-1000">{formatPounds(country.import_pence)}</td>
                    <td className="py-2 pr-3 tabular-nums text-gray-1000">{formatPounds(country.export_pence)}</td>
                    <td className="py-2 pr-3 tabular-nums text-gray-1000">
                      {formatPounds(netTradePence(country))}
                    </td>
                    <td className="py-2 tabular-nums text-gray-1000">
                      {formatGwh(country.import_mwh + country.export_mwh)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </div>
      </Card>
    </div>
  );
}
