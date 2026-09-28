export type StatProps = {
  stat: string;
  value: string;
  unit: string;
  datetime?: string | null;
  timeLabel?: string | null;
  source: string;
  sourceHref?: string;
  label?: string;
  detail?: string;
  size?: "default" | "headline";
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
  size = "default",
}: StatProps) {
  const headline = size === "headline";

  return (
    <div data-stat={stat} className="flex flex-col gap-1">
      {label ? (
        <p className={headline ? "text-sm text-gray-900" : "text-xs text-gray-900"}>{label}</p>
      ) : null}
      <p
        className={
          headline
            ? "font-sans text-4xl font-semibold tabular-nums tracking-tight text-gray-1000"
            : "font-mono text-2xl font-semibold tabular-nums text-gray-1000"
        }
      >
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
        {datetime && timeLabel ? (
          <>
            {" · "}
            <time dateTime={datetime}>{timeLabel}</time>
          </>
        ) : null}
      </p>
    </div>
  );
}
