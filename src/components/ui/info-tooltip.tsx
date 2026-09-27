"use client";

import { useId, useReducer, useRef } from "react";
import { Info } from "lucide-react";
import {
  initialInfoTooltipState,
  reduceInfoTooltip,
} from "@/components/ui/info-tooltip-state";

interface Props {
  text: string;
  label: string;
}

export function InfoTooltip({ text, label }: Props) {
  const tooltipId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [state, dispatch] = useReducer(reduceInfoTooltip, initialInfoTooltipState);

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => dispatch({ type: "hover-enter" })}
      onMouseLeave={() =>
        dispatch({
          type: "hover-leave",
          focused: buttonRef.current === document.activeElement,
        })
      }
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={state.open}
        aria-describedby={state.open ? tooltipId : undefined}
        onFocus={() => dispatch({ type: "focus" })}
        onBlur={() => dispatch({ type: "blur" })}
        onClick={() => dispatch({ type: "click" })}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            dispatch({ type: "escape" });
          }
        }}
        className="inline-grid size-6 place-items-center rounded-sm text-gray-900 hover:text-gray-1000 motion-reduce:transition-none"
      >
        <Info className="size-3.5" aria-hidden="true" />
      </button>
      {state.open ? (
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
