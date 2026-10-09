"use client";

import { useId, useReducer, useRef } from "react";
import {
  initialInfoTooltipState,
  reduceInfoTooltip,
} from "@/components/ui/info-tooltip-state";

interface Props {
  text: string;
  label: string;
  align?: "center" | "end";
}

export function InfoTooltip({ text, label, align = "center" }: Props) {
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
        className="inline-grid size-11 place-items-center text-gray-900 hover:text-gray-1000"
      >
        <span
          className="inline-flex size-3.5 items-center justify-center rounded-full border border-gray-alpha-400 text-[10px] leading-none"
          aria-hidden="true"
        >
          ?
        </span>
      </button>
      {state.open ? (
        <span
          id={tooltipId}
          role="tooltip"
          className={`absolute bottom-full z-50 mb-2 w-[min(280px,calc(100vw-2rem))] rounded-lg border border-gray-alpha-400 bg-background-100 px-3 py-2 text-left text-copy-14 text-gray-1000 ${
            align === "end" ? "right-0" : "left-1/2 -translate-x-1/2"
          }`}
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
