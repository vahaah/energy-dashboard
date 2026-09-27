import { describe, expect, it } from "vitest";
import {
  initialInfoTooltipState,
  reduceInfoTooltip,
} from "./info-tooltip-state";

describe("reduceInfoTooltip", () => {
  it("opens on click when the trigger is not focused (touch)", () => {
    const next = reduceInfoTooltip(initialInfoTooltipState, { type: "click" });
    expect(next.open).toBe(true);
  });

  it("does not close when hover-enter is followed by the same activation click", () => {
    const hovered = reduceInfoTooltip(initialInfoTooltipState, {
      type: "hover-enter",
    });
    const afterClick = reduceInfoTooltip(hovered, { type: "click" });
    expect(hovered.open).toBe(true);
    expect(afterClick.open).toBe(true);
  });

  it("does not close when focus is followed by the same activation click", () => {
    const focused = reduceInfoTooltip(initialInfoTooltipState, { type: "focus" });
    const afterClick = reduceInfoTooltip(focused, { type: "click" });
    expect(focused.open).toBe(true);
    expect(afterClick.open).toBe(true);
  });

  it("reopens on click after Escape while focus stays on the trigger", () => {
    const focused = reduceInfoTooltip(initialInfoTooltipState, { type: "focus" });
    const escaped = reduceInfoTooltip(focused, { type: "escape" });
    const reopened = reduceInfoTooltip(escaped, { type: "click" });
    expect(escaped.open).toBe(false);
    expect(reopened.open).toBe(true);
  });

  it("keeps the tooltip open when the pointer leaves a focused trigger", () => {
    const focused = reduceInfoTooltip(initialInfoTooltipState, { type: "focus" });
    const left = reduceInfoTooltip(focused, { type: "hover-leave", focused: true });
    expect(left.open).toBe(true);
  });
});
