import { Sparkline } from "@/components/sparkline";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import type { GroupedSourceTable } from "@/lib/source-groups";

export function SourceTable({ table }: { table: GroupedSourceTable }) {
  return (
    <div>
      {table.groups.map((group) => (
        <div key={group.id} className="border-b border-gray-alpha-200 last:border-b-0">
          <div className="flex min-w-0 items-center gap-2 px-1">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: group.color }} aria-hidden="true" />
            <p className="min-w-0 flex-1 truncate text-copy-14 font-medium text-gray-1000">{group.label}</p>
            <p className="w-14 shrink-0 text-right font-sans text-copy-14 tabular-nums text-gray-1000">
              {group.gwLabel}
              {group.mw != null ? <span className="text-gray-700"> GW</span> : null}
            </p>
            <p className="w-12 shrink-0 text-right font-sans text-copy-14 tabular-nums text-gray-900">{group.shareLabel}</p>
            <span className="w-16 shrink-0" />
            <InfoTooltip text={group.help} label={`What is ${group.label}?`} align="end" />
          </div>
          {group.rows.map((row) => (
            <div
              key={row.id}
              className="flex min-h-9 min-w-0 items-center gap-2 px-1 hover:bg-gray-alpha-100"
            >
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-copy-14 text-gray-1000">{row.label}</p>
                {row.missingNote ? <p className="text-label-12 text-gray-900">{row.missingNote}</p> : null}
              </div>
              <p className="w-14 text-right font-sans text-copy-14 tabular-nums text-gray-1000">
                {row.gwLabel}
                {row.mw != null ? <span className="text-gray-700"> GW</span> : null}
              </p>
              <p className="w-12 text-right font-sans text-copy-14 tabular-nums text-gray-900">{row.shareLabel}</p>
              <Sparkline values={row.sparkline} color={row.color} label={`${row.label} over 24 hours`} />
              <InfoTooltip text={row.help} label={`What is ${row.label}?`} align="end" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
