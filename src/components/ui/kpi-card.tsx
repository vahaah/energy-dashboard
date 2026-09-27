import { InfoTooltip } from "@/components/ui/info-tooltip";

interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  asOf?: string | null;
  color?: string;
  icon?: React.ReactNode;
  tooltip?: string;
}

export function KpiCard({ label, value, unit, detail, asOf, color, icon, tooltip }: KpiCardProps) {
  const isEmpty = value === "—";

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-gray-alpha-400 bg-background-100 p-4">
      <div className="flex items-center gap-1.5">
        {icon ? <span className="text-gray-900">{icon}</span> : null}
        <p className="text-xs text-gray-900">{label}</p>
        {tooltip ? <InfoTooltip text={tooltip} label={`What is ${label}?`} /> : null}
      </div>
      {asOf ? (
        <p className="font-mono text-xs tabular-nums text-gray-900">as of {asOf}</p>
      ) : null}
      <div className="flex items-baseline gap-1.5">
        {isEmpty ? (
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-semibold tabular-nums text-gray-800">
              —
            </span>
            {unit ? <span className="text-sm text-gray-800">{unit}</span> : null}
          </div>
        ) : (
          <>
            <span
              className="font-mono text-2xl font-semibold tabular-nums"
              style={color ? { color } : undefined}
            >
              {value}
            </span>
            {unit ? <span className="ml-1 text-sm text-gray-900">{unit}</span> : null}
          </>
        )}
      </div>
      {detail ? <p className="text-xs text-gray-900">{detail}</p> : null}
    </div>
  );
}
