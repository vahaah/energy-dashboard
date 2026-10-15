import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MapLayerChangeNotice } from "@/components/map-layer-change";
import type { LayerPointer } from "@/lib/map/layer-flag";

const POINTER: LayerPointer = {
  layer_id: "dno",
  edition: "20240503",
  url: "https://grid.vahaah.com/tiles/layers/dno/20240503.geojson",
  sha256: "sha256:45706a2dd90ea9f763df84fe916042074a113fa28da8597430d583f128398c89",
  bytes: 338625,
  source_url: "https://api.neso.energy/dataset/dno.geojson",
  source_etag: '"ecc"',
  source_sha256: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  status: "changed",
  checked_at: "2026-10-16T05:20:00.000Z",
};

describe("map layer change notice", () => {
  it("names the published edition and the new source hash", () => {
    const html = renderToStaticMarkup(<MapLayerChangeNotice pointer={POINTER} />);
    expect(html).toContain("NESO published a new DNO licence-area extract");
    expect(html).toContain("20240503");
    expect(html).toContain(POINTER.sha256);
    expect(html).toContain(POINTER.source_sha256);
  });
});