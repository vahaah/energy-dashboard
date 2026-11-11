export function ConstraintsHatch() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <defs>
        <pattern id="balancing-constraints-hatch" patternUnits="userSpaceOnUse" width="6" height="6">
          <rect width="6" height="6" fill="var(--chart-balancing-constraints)" />
          <path d="M0 6 L6 0" stroke="var(--chart-balancing-constraints-mark)" strokeWidth="1.5" />
        </pattern>
      </defs>
    </svg>
  );
}

export function Swatch({ color, hatch = false }: { color: string; hatch?: boolean }) {
  return (
    <span
      className="size-2 shrink-0 rounded-full"
      style={{
        backgroundColor: color,
        backgroundImage: hatch
          ? "repeating-linear-gradient(135deg, var(--chart-balancing-constraints-mark) 0 1px, transparent 1px 4px)"
          : undefined,
      }}
      aria-hidden="true"
    />
  );
}

export function LineSample({ dashed = false }: { dashed?: boolean }) {
  return (
    <span
      className={`inline-block h-0 w-4 shrink-0 border-t-2 border-gray-1000 ${dashed ? "border-dashed" : ""}`}
      aria-hidden="true"
    />
  );
}
