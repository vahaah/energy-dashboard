import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { layersFileSchema } from "@/lib/catalogue/layers";
import { DNO_SAMPLE_POINTS, DNO_SIMPLIFY_TOLERANCE_DEGREES } from "@/lib/map/constants";
import {
  areaAt,
  detectSourceCrs,
  parseFeatureCollection,
  pointInGeometry,
  publishDnoCollection,
  transformPosition,
  type GeoJsonFeatureCollection,
} from "@/lib/map/geojson";

function square(easting: number, northing: number, metres: number): GeoJsonFeatureCollection {
  const west = easting - metres;
  const east = easting + metres;
  const south = northing - metres;
  const north = northing + metres;
  return {
    type: "FeatureCollection",
    crs: { type: "name", properties: { name: "urn:ogc:def:crs:EPSG::27700" } },
    features: [
      {
        type: "Feature",
        properties: { ID: 1, Name: "_C", DNO: "UKPN", Area: "London", DNO_Full: "UK Power Networks" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south],
            ],
          ],
        },
      },
    ],
  };
}

describe("DNO transform", () => {
  it("detects EPSG:27700 and keeps a transformed London point inside the polygon", () => {
    const london = DNO_SAMPLE_POINTS[0];
    if (!london) {
      throw new Error("missing London sample");
    }
    const [easting, northing] = transformPosition("EPSG:27700", [530000, 180000]);
    expect(easting).toBeCloseTo(-0.1, 0);
    expect(northing).toBeCloseTo(51.5, 0);
    // 8 km around the OSGB square that contains central London.
    const published = publishDnoCollection(
      square(530030, 180300, 8_000),
      DNO_SIMPLIFY_TOLERANCE_DEGREES,
    );
    expect(published.sourceCrs).toBe("EPSG:27700");
    expect(detectSourceCrs(square(530030, 180300, 8_000))).toBe("EPSG:27700");
    expect(pointInGeometry(london.longitude, london.latitude, published.collection.features[0]!.geometry)).toBe(
      true,
    );
  });

  it("refuses a named CRS that disagrees with the coordinates", () => {
    const collection = square(530030, 180300, 100);
    collection.crs = { type: "name", properties: { name: "urn:ogc:def:crs:EPSG::4326" } };
    expect(() => detectSourceCrs(collection)).toThrow(/does not match/);
  });

  it("lands central London and the other regions in the published DNO areas", () => {
    const layers = layersFileSchema.parse(
      JSON.parse(readFileSync(join(process.cwd(), "data/catalogue/layers.json"), "utf8")),
    );
    const dno = layers.find((layer) => layer.id === "dno");
    expect(dno?.source_crs).toBe("EPSG:27700");
    expect(dno?.tolerance).toBe(DNO_SIMPLIFY_TOLERANCE_DEGREES);
    expect(dno?.default_visible).toBe(false);
    const relative = dno?.url.replace("https://grid.vahaah.com/", "");
    const collection = parseFeatureCollection(
      JSON.parse(readFileSync(join(process.cwd(), "public", relative ?? ""), "utf8")),
    );
    for (const point of DNO_SAMPLE_POINTS) {
      expect(areaAt(collection.features, point.longitude, point.latitude), point.name).toBe(point.area);
    }
  });
});
