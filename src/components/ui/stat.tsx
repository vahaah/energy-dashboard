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
      {label ? <p className="text-label-13 text-gray-900">{label}</p> : null}
      <p
        data-figure
        className={
          headline
            ? "whitespace-nowrap font-sans text-display tabular-nums text-gray-1000"
            : "whitespace-nowrap font-sans text-heading-24 tabular-nums text-gray-1000"
        }
      >
        <span data-value>{value}</span>
        <span data-unit={unit} className="align-baseline text-gray-700">
          {unit}
        </span>
      </p>
      {detail ? <p className="text-copy-14 text-gray-900">{detail}</p> : null}
      <p className="text-label-12 text-gray-900">
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
            <time className="text-mono-12" dateTime={datetime}>
              {timeLabel}
            </time>
          </>
        ) : null}
      </p>
    </div>
  );
}
