import { THIN_SPACE } from "@/lib/format/quantity";

export function Quantity({
  value,
  unit,
  className = "",
}: {
  value: string;
  unit: string;
  className?: string;
}) {
  return (
    <span className={`whitespace-nowrap tabular-nums ${className}`.trim()}>
      <span data-value>{value}</span>
      <span data-unit={unit} className="align-baseline text-[0.6em] font-medium text-gray-900">
        {THIN_SPACE}
        {unit}
      </span>
    </span>
  );
}
