import { UNLOCATED_REGION } from "@/lib/assets/types";
import type { AssetSourceLabel } from "@/lib/assets/types";
import { formatEnergy } from "@/lib/format/quantity";
import { fitDetailTitle } from "@/lib/seo/document-title";
import { DESCRIPTION_MAX_CHARS } from "@/lib/site";

export function assetSeoTitle(input: {
  name: string;
  technology: string;
  mw: number | null;
  region: string | null;
}): string {
  const energy =
    input.mw != null && Number.isFinite(input.mw) && input.mw > 0 ? formatEnergy(input.mw) : null;
  const detail = energy ? `${energy.value} ${energy.unit} ${input.technology}` : input.technology;
  const region = input.region && input.region !== UNLOCATED_REGION ? input.region : null;
  return fitDetailTitle(input.name, detail, region);
}

export function assetSourceCredit(source: AssetSourceLabel): string {
  switch (source) {
    case "REPD":
      return "DESNZ REPD";
    case "DUKES":
      return "DESNZ DUKES";
    case "Elexon":
      return "Elexon BMRS";
    case "National Gas":
      return "National Gas";
    default: {
      const neverSource: never = source;
      return neverSource;
    }
  }
}

export function assetSeoDescription(input: {
  name: string;
  technology: string;
  mw: number | null;
  region: string | null;
  operator: string | null;
  source: AssetSourceLabel;
}): string {
  const energy =
    input.mw != null && Number.isFinite(input.mw) && input.mw > 0 ? formatEnergy(input.mw) : null;
  const kind = [energy ? `${energy.value} ${energy.unit}` : null, input.technology].filter(
    (part): part is string => Boolean(part),
  );
  const place = input.region && input.region !== UNLOCATED_REGION ? ` in ${input.region}` : "";
  const operator = input.operator?.trim();
  const operated = operator && operator !== "Not available" ? `, operated by ${operator}` : "";
  return clampDescription(
    `${input.name} is a ${kind.join(" ")} site${place}${operated}. Status, location, capacity basis and source records from ${assetSourceCredit(input.source)}.`,
  );
}

export function clampDescription(text: string, max = DESCRIPTION_MAX_CHARS): string {
  const chars = [...text];
  if (chars.length <= max) {
    return text;
  }
  let body = chars
    .slice(0, max - 1)
    .join("")
    .replace(/\s+\S*$/, "")
    .trimEnd();
  if ([...body].length < 80) {
    body = chars.slice(0, max - 1).join("");
  }
  return `${body}…`;
}
