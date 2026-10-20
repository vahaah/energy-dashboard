import { parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";
import { ASSET_SORTS, ASSET_SOURCES, DIRECTORY_TECHNOLOGIES } from "@/lib/assets/types";

export const assetListParsers = {
  q: parseAsString.withDefault(""),
  preset: parseAsStringLiteral(["flows"] as const),
  technology: parseAsStringLiteral(DIRECTORY_TECHNOLOGIES),
  status: parseAsStringLiteral(["operational"] as const),
  source: parseAsStringLiteral(ASSET_SOURCES),
  region: parseAsString.withDefault(""),
  sort: parseAsStringLiteral(ASSET_SORTS).withDefault("name"),
  dir: parseAsStringLiteral(["asc", "desc"] as const).withDefault("asc"),
  page: parseAsInteger.withDefault(1),
};

export const mapViewParsers = {
  ...assetListParsers,
  sel: parseAsString,
  asset: parseAsString,
  layers: parseAsString.withDefault(""),
};
