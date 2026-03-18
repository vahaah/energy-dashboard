interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  color?: string;
}

export function KpiCard({ label, value, unit, detail, color }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span
          className="text-2xl font-semibold tabular-nums"
          style={color ? { color } : undefined}
        >
          {value}
        </span>
        {unit && (
          <span className="text-sm text-zinc-400 dark:text-zinc-500">{unit}</span>
        )}
      </div>
      {detail && (
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{detail}</p>
      )}
    </div>
  );
}
