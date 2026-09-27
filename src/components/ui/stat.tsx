export type StatProps = {
  stat: string;
  value: string;
  unit: string;
  datetime: string;
  timeLabel: string;
  source: string;
  sourceHref?: string;
  label?: string;
  detail?: string;
};

export function Stat({
  stat,
  value,
  unit,
  datetime,
  timeLabel,
  source,
  sourceHref,
  label,
  detail,
}: StatProps) {
  return (
    <div data-stat={stat} className="flex flex-col gap-1">
      {label ? <p className="text-xs text-gray-900">{label}</p> : null}
      <p className="font-mono text-2xl font-semibold tabular-nums text-gray-1000">
        <span>{value}</span>
        <span data-unit={unit} className="ml-1 font-sans text-sm font-normal text-gray-900">
          {unit}
        </span>
      </p>
      {detail ? <p className="text-sm text-gray-900">{detail}</p> : null}
      <p className="text-xs text-gray-900">
        {sourceHref ? (
          <a
            href={sourceHref}
            className="underline decoration-gray-alpha-400 underline-offset-2 hover:text-gray-1000"
            data-source={source}
          >
            {source}
          </a>
        ) : (
          <span data-source={source}>{source}</span>
        )}
        {" · "}
        <time dateTime={datetime}>{timeLabel}</time>
      </p>
    </div>
  );
}
