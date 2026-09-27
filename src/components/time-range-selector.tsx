"use client";

interface Props<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  pending?: boolean;
  compact?: boolean;
}

export function TimeRangeSelector<T extends string>({
  value,
  onChange,
  options,
  pending = false,
  compact = false,
}: Props<T>) {
  return (
    <div
      className={`inline-flex items-center rounded-full border border-gray-alpha-400 bg-background-200 ${
        pending ? "opacity-70" : ""
      }`}
      role="group"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          disabled={pending}
          className={`inline-flex h-11 min-w-11 items-center justify-center rounded-full px-3 font-medium motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 focus-visible:ring-offset-background-100 ${}
            compact ? "text-xs" : "text-sm"
          } ${
            value === opt.value
              ? "bg-gray-100 text-gray-1000"
              : "text-gray-900 hover:text-gray-1000"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
