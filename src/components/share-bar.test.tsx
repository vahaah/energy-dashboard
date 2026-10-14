import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ShareBar } from "@/components/share-bar";
import { generationMixShares } from "@/lib/generation-share";
import type { Generation5min } from "@/lib/types";

describe("share bar", () => {
  it("grows segments by the exact share and prints the reconciled percent", () => {
    const rows: Generation5min[] = [
      { timestamp: "2026-10-13 08:00:00", fuel_type: "wind", generation_mw: 6_000, source: "fuelinst" },
      { timestamp: "2026-10-13 08:00:00", fuel_type: "ccgt", generation_mw: 3_960, source: "fuelinst" },
      { timestamp: "2026-10-13 08:00:00", fuel_type: "oil", generation_mw: 40, source: "fuelinst" },
    ];
    const shares = generationMixShares(rows, null);
    const html = renderToStaticMarkup(
      <ShareBar shares={shares} generationGw="10.0" carbon={120} carbonHelp="Carbon intensity." />
    );

    expect(html).toContain("flex-grow:0.4");
    expect(html).toContain("Oil");
    expect(html).toContain("0%");
    expect(html).not.toContain("flex-grow:0;");
  });
});
