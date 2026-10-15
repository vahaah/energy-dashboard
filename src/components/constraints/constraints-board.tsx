import { ConstraintCostChart } from "@/components/constraints/constraint-cost-chart";
import { ConstraintVolumeChart } from "@/components/constraints/constraint-volume-chart";
import { Card } from "@/components/ui/card";
import {
  CONSTRAINTS_ALLOCATION,
  CONSTRAINTS_ATTRIBUTION,
  CONSTRAINTS_BOUNDARY_SOURCE,
  CONSTRAINTS_BOUNDARY_TITLE,
  CONSTRAINTS_COST_SOURCE,
  CONSTRAINTS_COST_TITLE,
  CONSTRAINTS_REVISIONS,
  CONSTRAINTS_VOLUME_SOURCE,
  CONSTRAINTS_VOLUME_TITLE,
} from "@/lib/constraints/copy";
import type { ConstraintsPageModel } from "@/lib/constraints/page-model";

function integer(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
}

export function ConstraintsBoard({ model }: { model: ConstraintsPageModel }) {
  const shares = model.latest?.rows.some((row) => row.share != null) ?? false;
  return (
    <div className="flex flex-col gap-4">
      {model.financialYear ? (
        <p className="text-copy-14 text-gray-900">NESO financial year {model.financialYear}.</p>
      ) : null}
      {model.cost ? (
        <Card title={CONSTRAINTS_COST_TITLE}>
          <p className="break-words text-copy-14 text-gray-900">{CONSTRAINTS_COST_SOURCE}</p>
          <p className="mt-2 text-copy-14 text-gray-900">{CONSTRAINTS_REVISIONS}</p>
          {model.earlierReleaseKept ? (
            <p className="mt-2 text-copy-14 text-gray-900">An earlier release for this financial year is kept.</p>
          ) : null}
          <div className="mt-4">
            <ConstraintCostChart series={model.cost} />
          </div>
        </Card>
      ) : null}
      {model.volume ? (
        <Card title={CONSTRAINTS_VOLUME_TITLE}>
          <p className="break-words text-copy-14 text-gray-900">{CONSTRAINTS_VOLUME_SOURCE}</p>
          <div className="mt-4">
            <ConstraintVolumeChart series={model.volume} />
          </div>
        </Card>
      ) : null}
      {model.latest ? (
        <Card title={`Settlement date ${model.latest.settlementDate}`}>
          <div className="min-w-0 max-w-full overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-copy-14">
              <thead>
                <tr className="text-label-12 text-gray-900">
                  <th className="py-2 pr-4 font-normal">Category</th>
                  <th className="py-2 pr-4 font-normal">£</th>
                  <th className="py-2 pr-4 font-normal">MWh</th>
                  {shares ? <th className="py-2 font-normal">Share of £</th> : null}
                </tr>
              </thead>
              <tbody>
                {model.latest.rows.map((row) => (
                  <tr key={row.category} className="border-t border-gray-alpha-400">
                    <th className="py-2 pr-4 text-left font-normal text-gray-1000">{row.label}</th>
                    <td className="py-2 pr-4 tabular-nums text-gray-1000">{integer(row.gbp)}</td>
                    <td className="py-2 pr-4 tabular-nums text-gray-1000">{integer(row.mwh)}</td>
                    {shares ? (
                      <td className="py-2 tabular-nums text-gray-1000">{row.share == null ? "—" : `${row.share}%`}</td>
                    ) : null}
                  </tr>
                ))}
                <tr className="border-t border-gray-alpha-400">
                  <th className="py-2 pr-4 text-left font-normal text-gray-1000">Total</th>
                  <td className="py-2 pr-4 tabular-nums text-gray-1000">{integer(model.latest.totalGbp)}</td>
                  <td className="py-2 pr-4 tabular-nums text-gray-1000">{integer(model.latest.totalMwh)}</td>
                  {shares ? <td className="py-2 tabular-nums text-gray-1000">100%</td> : null}
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
      {model.dayAhead ? (
        <Card title={CONSTRAINTS_BOUNDARY_TITLE}>
          <p className="break-words text-copy-14 text-gray-900">{CONSTRAINTS_BOUNDARY_SOURCE}</p>
          <p className="mt-2 text-copy-14 text-gray-1000">{model.dayAhead.issuedLabel}</p>
          <p className="mt-2 break-words text-copy-14 text-gray-900">{CONSTRAINTS_ALLOCATION}</p>
          <p className="mt-2 break-words text-copy-14 text-gray-900">
            No boundary map is drawn. The file names constraint groups and does not carry coordinates.
          </p>
          <div className="mt-4 flex min-w-0 flex-col gap-2">
            {model.dayAhead.boundaries.map((boundary) => (
              <details
                key={boundary.boundary}
                className="min-w-0 rounded-lg border border-gray-alpha-400 [&:not([open])>:not(summary)]:hidden"
              >
                <summary className="cursor-pointer px-3 py-3 text-copy-14 break-words text-gray-1000">
                  <span className="font-medium">{boundary.boundary}</span>
                  <span className="mt-1 block text-copy-14 break-words text-gray-900">
                    {model.dayAhead?.settlementDate} {boundary.latestWall}
                  </span>
                  <span className="mt-1 block text-copy-14 text-gray-900">
                    Limit {integer(boundary.latestLimit)} MW
                  </span>
                  <span className="mt-1 block text-copy-14 text-gray-900">
                    Flow {integer(boundary.latestFlow)} MW
                  </span>
                </summary>
                <div className="min-w-0 max-w-full overflow-x-auto px-3 pb-3">
                  <table className="w-full table-fixed text-left text-copy-14">
                    <thead>
                      <tr className="text-label-12 text-gray-900">
                        <th className="py-2 pr-2 font-normal">Time</th>
                        <th className="py-2 pr-2 font-normal">Limit MW</th>
                        <th className="py-2 font-normal">Flow MW</th>
                      </tr>
                    </thead>
                    <tbody>
                      {boundary.intervals.map((interval) => (
                        <tr key={`${boundary.boundary}-${interval.wall}`} className="border-t border-gray-alpha-400">
                          <th className="py-2 pr-2 text-left font-normal tabular-nums text-gray-1000">{interval.wall}</th>
                          <td className="py-2 pr-2 tabular-nums text-gray-1000">{integer(interval.limit)}</td>
                          <td className="py-2 tabular-nums text-gray-1000">{integer(interval.flow)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        </Card>
      ) : null}
      <p className="text-copy-14 text-gray-900">{CONSTRAINTS_ATTRIBUTION}</p>
    </div>
  );
}
