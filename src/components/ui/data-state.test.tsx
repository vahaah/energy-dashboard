import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataStateNotice } from "@/components/ui/data-state";
import { ABSENT_FIGURE, DATA_STATE_LABEL, DATA_STATES, formatAbsent } from "@/lib/data-state";

describe("shared data state", () => {
  it("shows each state with text, not colour alone", () => {
    for (const state of DATA_STATES) {
      const html = renderToStaticMarkup(<DataStateNotice state={state} />);
      expect(html).toContain(DATA_STATE_LABEL[state]);
      expect(html).toContain('aria-hidden="true"');
      expect(html).not.toMatch(/bg-(red|amber|emerald|green|yellow|orange)-/);
    }
  });

  it("renders missing numbers as an em dash and keeps a real zero", () => {
    expect(formatAbsent(null)).toBe(ABSENT_FIGURE);
    expect(formatAbsent(undefined)).toBe(ABSENT_FIGURE);
    expect(formatAbsent(Number.NaN)).toBe(ABSENT_FIGURE);
    expect(formatAbsent(0)).toBe("0");
  });
});
