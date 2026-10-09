import type { GroupedSourceTable } from "@/lib/source-groups";

export function MixBar({ table }: { table: GroupedSourceTable }) {
  if (table.mix.length === 0) {
    return <div className="h-3 w-full rounded-full bg-background-200" aria-hidden="true" />;
  }

  return (
    <div
      className="flex h-3 w-full overflow-hidden rounded-full bg-background-200"
      role="img"
      aria-label="Share of demand by source"
    >
      {table.mix.map((segment) => (
        <span
          key={segment.id}
          className={`h-full shrink-0 ${segment.hatched ? "import-hatch" : ""}`}
          style={{
            width: `${segment.pct}%`,
            backgroundColor: segment.hatched ? undefined : segment.color,
          }}
          title={`${segment.label} ${segment.pct.toFixed(1)}%`}
        />
      ))}
    </div>
  );
}
