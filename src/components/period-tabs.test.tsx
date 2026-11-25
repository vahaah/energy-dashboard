import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PeriodTabs } from "@/components/period-tabs";

describe("period tabs", () => {
  it("checks the active period", () => {
    const html = renderToStaticMarkup(
      <PeriodTabs period="week" pending={false} onPeriodChange={() => undefined} />
    );
    expect(html).toContain('aria-checked="true"');
    expect(html).toMatch(/Week/);
    expect(html).toContain(">Day<");
    expect(html).toContain(">Year<");
    expect(html).toContain(">All<");
    expect(html).not.toContain("overflow-x-auto");
    expect(html).toContain("flex-wrap");
  });
});
