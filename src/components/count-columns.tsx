import type { CountRow } from "@/lib/projects/list";

export function CountColumns({
  columns,
}: {
  columns: readonly { title: string; rows: readonly CountRow[] }[];
}) {
  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-3">
      {columns.map((column) => (
        <div key={column.title} className="min-w-0">
          <h3 className="text-label-13 text-gray-900">{column.title}</h3>
          <ul className="mt-2 flex min-w-0 flex-col">
            {column.rows.map((row) => (
              <li
                key={row.label}
                className="flex min-w-0 items-baseline justify-between gap-3 border-t border-gray-alpha-400 py-2 first:border-t-0"
              >
                <span className="min-w-0 break-words text-copy-14 text-gray-1000">{row.label}</span>
                <span className="shrink-0 text-label-13 tabular-nums text-gray-900">
                  {row.count.toLocaleString("en-GB")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
