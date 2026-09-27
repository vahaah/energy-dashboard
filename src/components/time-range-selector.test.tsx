import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TimeRangeSelector } from "./time-range-selector";

describe("TimeRangeSelector", () => {
  it("marks the selected option with aria-pressed and a 44px tap target", () => {
    const html = renderToStaticMarkup(
      <TimeRangeSelector
        value="24h"
        onChange={() => undefined}
        options={[
          { value: "24h", label: "24h" },
          { value: "7d", label: "7d" },
        ]}
      />
    );

    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("h-11");
    expect(html).toContain("min-w-11");
  });
});
