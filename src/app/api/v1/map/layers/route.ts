import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { layersFileSchema } from "@/lib/catalogue/layers";
import { CATALOGUE_SCHEMA_VERSION } from "@/lib/catalogue/schema";

/**
 * GET /api/v1/map/layers
 *
 * The checked-in layer catalogue. Static: no Tinybird, no write, no map library.
 */
export const dynamic = "force-static";
export const revalidate = 86_400;

const CACHE_CONTROL = "public, max-age=3600, stale-while-revalidate=86400";

export function GET() {
  const layers = layersFileSchema.parse(
    JSON.parse(readFileSync(join(process.cwd(), "data", "catalogue", "layers.json"), "utf8")),
  );
  return NextResponse.json(
    { catalogue_schema_version: CATALOGUE_SCHEMA_VERSION, layers },
    {
      headers: {
        "Cache-Control": CACHE_CONTROL,
        "CDN-Cache-Control": CACHE_CONTROL,
        "Vercel-CDN-Cache-Control": CACHE_CONTROL,
      },
    },
  );
}
