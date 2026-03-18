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
      className={`inline-flex rounded-full border border-white/12 bg-white/6 p-1 gap-1 ${
        pending ? "opacity-70" : ""
      }`}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-full transition-all duration-150 ${
            value === opt.value
              ? "bg-emerald-400/18 text-emerald-200 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.3)]"
              : "text-zinc-400 hover:text-zinc-100"
          }`}
          disabled={pending}
        >
          <span
            className={`block ${
              compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
            } font-medium`}
          >
            {opt.label}
          </span>
        </button>
      ))}
    </div>
  );
}
