import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PeriodTabs } from "@/components/period-tabs";

describe("period tabs", () => {
  it("puts aria-current on the active period", () => {
    const html = renderToStaticMarkup(
      <PeriodTabs period="week" pending={false} onPeriodChange={() => undefined} />
    );
    expect(html.match(/aria-current="page"/g)?.length).toBe(1);
    expect(html).toMatch(/<button[^>]*aria-current="page"[^>]*>Week<\/button>/);
    expect(html).toContain(">Day<");
    expect(html).toContain(">Year<");
    expect(html).toContain(">All<");
    expect(html).not.toContain("overflow-x-auto");
    expect(html).toContain("flex-wrap");
  });
});
