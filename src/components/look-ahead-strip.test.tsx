import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LookAheadStrip } from "@/components/look-ahead-strip";
import { emptyLookAhead } from "@/lib/forecast-model";

describe("LookAheadStrip", () => {
  it("renders the carbon teaser and wind sentence when both exist", () => {
    const html = renderToStaticMarkup(
      <LookAheadStrip
        lookAhead={{
          ...emptyLookAhead(new Date("2026-10-10T12:00:00.000Z")),
          greenest: {
            startUtc: "2026-10-10T13:00Z",
            endUtc: "2026-10-10T15:00Z",
            grams: 43,
            sentence: "Cleanest time to use power in the next 48 hours: 14:00–16:00 BST (≈43 g).",
          },
          wind: {
            tonightGw: 11,
            tomorrowEveningGw: 8.4,
            sparkline: [11, 9, 8.4],
            sentence: "Wind is forecast to fall to 8.4 GW by tomorrow evening.",
            basis: "Transmission-connected wind only. Embedded wind is not in this forecast.",
          },
        }}
      />
    );

    expect(html).toContain('href="#section-carbon"');
    expect(html).toContain(
      "Cleanest time to use power in the next 48 hours: 14:00–16:00 BST (≈43 g)."
    );
    expect(html).toContain("Wind is forecast to fall to 8.4 GW by tomorrow evening.");
    expect(html).toContain("Grid fetched 13:00 BST");
    expect(html).toContain("Elexon WINDFOR");
  });

  it("renders nothing when forecast APIs returned no look-ahead", () => {
    const html = renderToStaticMarkup(
      <LookAheadStrip lookAhead={emptyLookAhead(new Date("2026-10-10T12:00:00.000Z"))} />
    );
    expect(html).toBe("");
  });
});
