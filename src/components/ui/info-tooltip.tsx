"use client";

import { useId, useLayoutEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  initialInfoTooltipState,
  reduceInfoTooltip,
} from "@/components/ui/info-tooltip-state";
import { clampTooltipLeft, placeTooltipTop } from "@/lib/tooltip-position";

interface Props {
  text: ReactNode;
  label: string;
  align?: "center" | "end";
}

export function InfoTooltip({ text, label, align = "center" }: Props) {
  const tooltipId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [state, dispatch] = useReducer(reduceInfoTooltip, initialInfoTooltipState);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [anchor, setAnchor] = useState<{
    left: number;
    width: number;
    top: number;
    height: number;
  } | null>(null);
  const [top, setTop] = useState<number | null>(null);

  const measure = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    setAnchor({ left: rect.left, width: rect.width, top: rect.top, height: rect.height });
    setTop(null);
  };

  useLayoutEffect(() => {
    if (!state.open || !anchor || !tipRef.current) {
      return;
    }
    const height = tipRef.current.getBoundingClientRect().height;
    setTop(placeTooltipTop(anchor.top, anchor.height, height, window.innerHeight));
  }, [state.open, anchor]);

  const placement = state.open && anchor
    ? clampTooltipLeft(anchor.left, anchor.width, window.innerWidth, 280, 16, align)
    : null;

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => {
        measure();
        dispatch({ type: "hover-enter" });
      }}
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
        onFocus={() => {
          measure();
          dispatch({ type: "focus" });
        }}
        onBlur={() => dispatch({ type: "blur" })}
        onClick={() => {
          measure();
          dispatch({ type: "click" });
        }}
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
      {state.open && placement && anchor && typeof document !== "undefined"
        ? createPortal(
            <span
              ref={tipRef}
              id={tooltipId}
              role="tooltip"
              className="fixed z-50 rounded-lg border border-gray-alpha-400 bg-background-100 px-3 py-2 text-left text-copy-14 text-gray-1000"
              style={{
                left: placement.left,
                width: placement.width,
                top: top ?? 0,
                visibility: top == null ? "hidden" : "visible",
              }}
            >
              {text}
            </span>,
            document.body
          )
        : null}
    </span>
  );
}
