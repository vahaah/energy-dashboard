import { Sparkline } from "@/components/sparkline";
import { DataStateNotice } from "@/components/ui/data-state";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import type { GroupedSourceTable } from "@/lib/source-groups";

export function SourceTable({ table }: { table: GroupedSourceTable }) {
  return (
    <div className="overflow-x-auto">
      {table.groups.map((group) => (
        <div key={group.id} className="border-b border-gray-alpha-200 last:border-b-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: group.color }} aria-hidden="true" />
            <p className="min-w-0 flex-1 break-words text-copy-14 font-medium text-gray-1000">{group.label}</p>
            <p data-figure className="w-14 shrink-0 whitespace-nowrap text-right font-sans text-copy-14 tabular-nums text-gray-1000">
              <span data-value>{group.gwLabel}</span>
              {group.mw != null ? (
                <span data-unit className="align-baseline text-[0.6em] text-gray-900">
                  {" "}
                  GW
                </span>
              ) : null}
            </p>
            <p className="w-20 shrink-0 text-right font-sans text-copy-14 tabular-nums text-gray-900">{group.shareLabel}</p>
            <span className="w-16 shrink-0" />
            <InfoTooltip text={group.help} label={`What is ${group.label}?`} align="end" />
          </div>
          {group.rows.map((row) => (
            <div
              key={row.id}
              className="flex min-h-9 min-w-0 items-center gap-2 hover:bg-gray-alpha-100"
            >
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-copy-14 text-gray-1000">{row.label}</p>
                {row.missingNote ? (
                  <p className="mt-1 flex max-w-full flex-wrap items-center gap-1.5 text-label-12 text-gray-900">
                    {row.missingNote === "no data" ? <DataStateNotice state="unavailable" /> : null}
                    <span>{row.missingNote}</span>
                  </p>
                ) : null}
              </div>
              <p data-figure className="w-14 shrink-0 whitespace-nowrap text-right font-sans text-copy-14 tabular-nums text-gray-1000">
                <span data-value>{row.gwLabel}</span>
                {row.mw != null ? (
                  <span data-unit className="align-baseline text-[0.6em] text-gray-900">
                    {" "}
                    GW
                  </span>
                ) : null}
              </p>
              <p className="w-20 shrink-0 text-right font-sans text-copy-14 tabular-nums text-gray-900">
                {row.shareLabel}
              </p>
              <Sparkline values={row.sparkline} color={row.color} label={`${row.label} over 24 hours`} />
              <InfoTooltip text={row.help} label={`What is ${row.label}?`} align="end" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
