import { parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";
import { TECHNOLOGIES } from "@/lib/catalogue/assets/technologies";
import { ASSET_SORTS, ASSET_SOURCES } from "@/lib/assets/types";

export const assetListParsers = {
  q: parseAsString.withDefault(""),
  technology: parseAsStringLiteral(TECHNOLOGIES),
  status: parseAsStringLiteral(["operational"] as const),
  source: parseAsStringLiteral(ASSET_SOURCES),
  region: parseAsString.withDefault(""),
  sort: parseAsStringLiteral(ASSET_SORTS).withDefault("name"),
  dir: parseAsStringLiteral(["asc", "desc"] as const).withDefault("asc"),
  page: parseAsInteger.withDefault(1),
};
