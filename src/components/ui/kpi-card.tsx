interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  color?: string;
  icon?: React.ReactNode;
}

export function KpiCard({ label, value, unit, detail, color, icon }: KpiCardProps) {
  const isEmpty = value === "—";

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-4 flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-zinc-400 dark:text-zinc-500">{icon}</span>}
        <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          {label}
        </p>
      </div>
      <div className="flex items-baseline gap-1.5">
        {isEmpty ? (
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tabular-nums text-zinc-300 dark:text-zinc-700">
              —
            </span>
            {unit && (
              <span className="text-sm text-zinc-300 dark:text-zinc-700">{unit}</span>
            )}
          </div>
        ) : (
          <>
            <span
              className="text-2xl font-semibold tabular-nums"
              style={color ? { color } : undefined}
            >
              {value}
            </span>
            {unit && (
              <span className="text-sm text-zinc-400 dark:text-zinc-500">{unit}</span>
            )}
          </>
        )}
      </div>
      {detail && (
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 capitalize">{detail}</p>
      )}
    </div>
  );
}
