"use client";

import { useId, useState } from "react";
import { Info } from "lucide-react";

interface Props {
  text: string;
  label: string;
}

export function InfoTooltip({ text, label }: Props) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className="inline-grid size-6 place-items-center rounded-sm text-gray-900 hover:text-gray-1000 motion-reduce:transition-none"
      >
        <Info className="size-3.5" aria-hidden="true" />
      </button>
      {open ? (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-lg bg-gray-200 px-3 py-2 text-center text-xs text-gray-1000 shadow-lg"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
