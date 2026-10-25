import { Sparkline } from "@/components/sparkline";
import { DataStateNotice } from "@/components/ui/data-state";
import type { GroupedSourceTable } from "@/lib/source-groups";

export function SourceTable({ table }: { table: GroupedSourceTable }) {
  return (
    <div>
      {table.groups.map((group) => (
        <div key={group.id} className="border-b border-gray-alpha-200 py-2 last:border-b-0">
          <div className="flex items-baseline justify-between gap-3">
            <p className="inline-flex min-w-0 items-center gap-2 text-copy-14 font-medium text-gray-1000">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: group.color }} aria-hidden="true" />
              <span>{group.label}</span>
            </p>
            <p className="shrink-0 text-right text-copy-14 tabular-nums text-gray-900">
              <span data-value className="text-gray-1000">{group.gwLabel}</span>
              {group.mw != null ? (
                <span data-unit className="align-baseline unit-label text-gray-900">
                  {" "}
                  GW
                </span>
              ) : null}
              <span className="ml-3">{group.shareLabel}</span>
            </p>
          </div>
          {group.rows.map((row) => (
            <div key={row.id} className="mt-1 flex items-baseline justify-between gap-3 py-1" title={row.help}>
              <div className="min-w-0">
                <p className="inline-flex min-w-0 items-center gap-2 text-copy-14 text-gray-1000">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} aria-hidden="true" />
                  <span>{row.label}</span>
                </p>
                {row.missingNote ? (
                  <p className="mt-1 flex max-w-full flex-wrap items-center gap-1.5 pl-4 text-label-13 text-gray-900">
                    {row.missingNote === "no data" ? <DataStateNotice state="unavailable" /> : null}
                    <span>{row.missingNote}</span>
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <p data-figure className="text-right text-copy-14 tabular-nums text-gray-1000">
                  <span data-value>{row.gwLabel}</span>
                  {row.mw != null ? (
                    <span data-unit className="align-baseline unit-label text-gray-900">
                      {" "}
                      GW
                    </span>
                  ) : null}
                  <span className="ml-3 text-gray-900">{row.shareLabel}</span>
                </p>
                <Sparkline values={row.sparkline} color={row.color} label={`${row.label} over 24 hours`} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
