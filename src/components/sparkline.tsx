export function Sparkline({
  values,
  color,
  label,
  variant = "line",
}: {
  values: number[];
  color: string;
  label: string;
  variant?: "line" | "step";
}) {
  const width = 64;
  const height = 16;
  if (values.length === 0) {
    return <span className="inline-block h-4 w-16" aria-hidden="true" />;
  }

  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const span = max - min || 1;
  const step = values.length === 1 ? 0 : width / (values.length - 1);
  const yAt = (value: number) => height - ((value - min) / span) * (height - 2) - 1;
  const points =
    variant === "step"
      ? values
          .flatMap((value, index) => {
            const x = index * step;
            const y = yAt(value);
            if (index === 0) {
              return [`${x},${y}`];
            }
            const previous = yAt(values[index - 1] ?? value);
            return [`${x},${previous}`, `${x},${y}`];
          })
          .join(" ")
      : values
          .map((value, index) => {
            const x = index * step;
            return `${x},${yAt(value)}`;
          })
          .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <title>{label}</title>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
}
