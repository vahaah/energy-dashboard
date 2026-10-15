import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/v1/map/layers/route";
import { DNO_ATTRIBUTION, NESO_DNO_ACCURACY_WARNING } from "@/lib/map/constants";

describe("GET /api/v1/map/layers", () => {
  it("serves the checked-in catalogue statically", async () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/api/v1/map/layers/route.ts"), "utf8");
    expect(source).toContain('export const dynamic = "force-static"');
    expect(source).not.toContain("queryPipe");
    expect(source).not.toContain("maplibre-gl");
    expect(source).not.toContain("pmtiles");
    const response = await GET();
    expect(response.headers.get("Cache-Control")).toContain("public");
    const body = (await response.json()) as {
      layers: Array<{ id: string; attribution: string; accuracy_warning: string | null; default_visible: boolean }>;
    };
    const dno = body.layers.find((layer) => layer.id === "dno");
    expect(dno?.attribution).toBe(DNO_ATTRIBUTION);
    expect(dno?.accuracy_warning).toBe(NESO_DNO_ACCURACY_WARNING);
    expect(dno?.default_visible).toBe(false);
  });
});
