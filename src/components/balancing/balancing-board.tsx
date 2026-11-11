"use client";

import { useState } from "react";
import { DailyCostChart } from "@/components/balancing/daily-cost-chart";
import { MonthlyCostChart } from "@/components/balancing/monthly-cost-chart";
import { TradeChart, tradeChartRows } from "@/components/balancing/trade-chart";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { Card } from "@/components/ui/card";
import { TableScroll } from "@/components/ui/table-scroll";
import { netTradePence } from "@/lib/balancing/aggregate";
import { compareCountries } from "@/lib/balancing/countries";
import { TRADE_ESTIMATE_BADGE, TRADE_LABEL, TRADE_TITLE } from "@/lib/balancing/copy";
import { formatBalancingDate } from "@/lib/balancing/dates";
import { formatGwh, formatPounds } from "@/lib/balancing/money";
import {
  dailySeries,
  monthlySeries,
  tradeCountryTotals,
  tradeInRange,
  tradeNet,
  type BalancingPageModel,
} from "@/lib/balancing/page-model";
import { BALANCING_RANGES, type BalancingRange } from "@/lib/balancing/types";

const RANGE_OPTIONS: ReadonlyArray<{ value: BalancingRange; label: string; accessibleName?: string }> = [
  { value: "90d", label: "90 days" },
  { value: "1y", label: "1 year" },
  { value: "fy", label: "FY", accessibleName: "This financial year" },
  { value: "all", label: "All" },
];

function isRange(value: string): value is BalancingRange {
  return (BALANCING_RANGES as readonly string[]).includes(value);
}

function rangePhrase(range: BalancingRange, through: string): string {
  const date = formatBalancingDate(through);
  switch (range) {
    case "90d":
      return `90 days to ${date}`;
    case "1y":
      return `1 year to ${date}`;
    case "fy":
      return `This financial year to ${date}`;
    case "all":
      return `All published days to ${date}`;
    default: {
      const exhaustive: never = range;
      return exhaustive;
    }
  }
}

export function BalancingBoard({ model }: { model: BalancingPageModel }) {
  const [range, setRange] = useState<BalancingRange>("90d");
  const [monthlyRange, setMonthlyRange] = useState<BalancingRange>("1y");
  const daily = dailySeries(model, range);
  const monthly = monthlySeries(model, monthlyRange);
  const months = tradeInRange(model, range);
  const countries = tradeCountryTotals(months).sort((left, right) => compareCountries(left.country, right.country));
  const net = tradeNet(months);
  const through = model.today;

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
      <Card id="daily" title="Daily balancing cost">
        <p className="break-words text-copy-14 text-gray-900">
          Six NESO categories. Negatives, such as income from selling surplus power, are drawn below zero. A gap is a
          day NESO did not publish. Incomplete means the day has fewer half-hours than the clock.
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
      <Card
        id="monthly"
        title="Monthly balancing cost: constraints and the other five categories"
        actions={
          <TimeRangeSelector
            value={monthlyRange}
            onChange={(next) => {
              if (isRange(next)) {
                setMonthlyRange(next);
              }
            }}
            options={RANGE_OPTIONS}
            ariaLabel="Monthly range"
            compact
          />
        }
      >
        <p className="break-words text-copy-14 text-gray-900">
          Constraints against the other five categories. The dashed line is the final BSUoS tariff in force at the start
          of the month, in £/MWh, on its own axis.
        </p>
        <div className="mt-4 min-w-0">
          <MonthlyCostChart points={monthly} />
        </div>
      </Card>
      <Card
        id="trade"
        title={TRADE_TITLE}
        actions={
          <span className="inline-flex h-6 items-center rounded-md border border-gray-alpha-400 px-2 text-label-12 text-gray-1000">
            {TRADE_ESTIMATE_BADGE}
          </span>
        }
      >
        <p className="break-words text-copy-14 text-gray-900">{TRADE_LABEL}</p>
        <p className="mt-2 break-words text-copy-14 tabular-nums text-gray-1000">
          {rangePhrase(range, through)}: imports {formatPounds(net.importPence)} · exports {formatPounds(net.exportPence)} ·
          net imports {formatPounds(net.netPence)} (estimates)
        </p>
        <div className="mt-4 min-w-0">
          <TradeChart rows={tradeChartRows(months)} />
        </div>
        <div className="mt-4 min-w-0">
          <TableScroll>
            <table className="w-full min-w-[40rem] text-left text-copy-14">
              <thead>
                <tr className="text-label-12 text-gray-900">
                  <th className="py-2 pr-3 font-normal">Link to</th>
                  <th className="py-2 pr-3 font-normal">Imports (est. £)</th>
                  <th className="py-2 pr-3 font-normal">Exports (est. £)</th>
                  <th className="py-2 pr-3 font-normal">Net imports (est. £)</th>
                  <th className="py-2 font-normal">Energy, imports + exports (GWh)</th>
                </tr>
              </thead>
              <tbody>
                {countries.map((country) => (
                  <tr key={country.country} className="border-t border-gray-alpha-400">
                    <th className="py-2 pr-3 text-left font-normal break-words text-gray-1000">{country.country}</th>
                    <td className="py-2 pr-3 tabular-nums text-gray-1000">{formatPounds(country.import_pence)}</td>
                    <td className="py-2 pr-3 tabular-nums text-gray-1000">{formatPounds(country.export_pence)}</td>
                    <td className="py-2 pr-3 tabular-nums text-gray-1000">{formatPounds(netTradePence(country))}</td>
                    <td className="py-2 tabular-nums text-gray-1000">{formatGwh(country.import_mwh + country.export_mwh)}</td>
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
