export const LAYER_PRECISIONS = [
  "surveyed",
  "published_approximate",
  "geocoded_approximate",
  "schematic",
] as const;

export type LayerPrecision = (typeof LAYER_PRECISIONS)[number];
