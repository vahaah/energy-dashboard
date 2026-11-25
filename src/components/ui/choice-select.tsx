"use client";

import { Select, SelectContent, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@ui-sdk/react/select";

export type ChoiceOption = {
  value: string;
  label: string;
};

const TRIGGER =
  "inline-flex h-11 min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-gray-alpha-400 bg-background-100 px-3 text-left text-copy-16 text-gray-1000 sm:h-8 sm:min-h-8 sm:text-label-13";

const POPUP =
  "z-50 max-h-80 min-w-[var(--anchor-width)] overflow-y-auto overscroll-contain rounded-md border border-gray-alpha-400 bg-background-100 py-1";

const ITEM =
  "flex min-h-11 items-center px-3 text-copy-14 text-gray-1000 data-highlighted:bg-gray-100";

export function ChoiceSelect({
  label,
  name,
  value,
  onValueChange,
  options,
  className = "",
  labelClassName = "text-label-13 text-gray-900",
  hideLabel = false,
}: {
  label: string;
  name?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly ChoiceOption[];
  className?: string;
  labelClassName?: string;
  hideLabel?: boolean;
}) {
  return (
    <Select
      name={name}
      value={value}
      items={options.map((option) => ({ value: option.value, label: option.label }))}
      onValueChange={(next) => {
        if (next) {
          onValueChange(next);
        }
      }}
    >
      <SelectLabel className={hideLabel ? "sr-only" : labelClassName}>{label}</SelectLabel>
      <SelectTrigger className={`${TRIGGER} ${className}`.trim()} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className={POPUP}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className={ITEM}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
