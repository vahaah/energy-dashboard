import { NATIONAL_GAS_ATTRIBUTION } from "@/lib/attribution";

export const GAS_SYSTEM_TITLE = "GB gas supply, demand and linepack by gas day | Grid";
export const GAS_SYSTEM_DESCRIPTION =
  "Gas into and out of Britain's National Transmission System by gas day: supply by terminal, demand, linepack and storage flows. Free, updated hourly.";

export const GAS_SYSTEM_H1 = "Where is Britain's gas coming from, and where is it going?";

export const GAS_SYSTEM_STANDFIRST =
  "Supply into and demand from the National Transmission System, by gas day. Updated hourly.";

export const GAS_EYEBROW = "Gas · National Transmission System";

export const GAS_SCOPE = "National Transmission System";

export const GAS_COVERAGE_LABEL = "Coverage";

export const GAS_COVERAGE_HREF = "/data-health#nts";

export const GAS_PRICES_LABEL = "Gas prices";

export const GAS_PRICES_HREF = "/prices/gas";

export const GAS_PAGE_BASES = ["flow", "to-date", "completed"] as const;

export type GasPageBasis = (typeof GAS_PAGE_BASES)[number];

export const GAS_BASIS_LABEL: Record<GasPageBasis, string> = {
  flow: "Latest hourly flow rate",
  "to-date": "So far this gas day",
  completed: "Completed gas day",
};

export const GAS_LDZ_PUBLICATION_ID = "PUBOBJ1015";

export const GAS_LDZ_HEADING =
  "Distribution networks (LDZ offtake). Gas taken by local networks for homes, businesses and some industry.";

export const GAS_LDZ_NOTE =
  "Distribution-network demand includes multiple kinds of consumer. It is not a direct measure of household heating.";

export const GAS_STORAGE_NOTICE =
  "Storage inventory unavailable for this selection. Injection and withdrawal flows are available. Grid does not currently have a compatible inventory series.";

export const GAS_LINEPACK_DESCRIPTION = "Gas held in the pipelines";

export const GAS_SAP_DEFINITION =
  "System Average Price, a wholesale benchmark. It is not a household tariff.";

export const GAS_UNIT_DAY = "million m³/day";

export const GAS_UNIT_STOCK = "million m³";

export const GAS_ATTRIBUTION = NATIONAL_GAS_ATTRIBUTION;

export function gasDayLabelText(
  date: string,
  start: string,
  end: string,
  startZone: string,
  endZone: string,
): string {
  const range =
    startZone === endZone ? `${start}–${end} ${startZone}` : `${start} ${startZone}–${end} ${endZone}`;
  return `Gas day ${date}, ${range}`;
}

export function gasStaleText(observedAt: string): string {
  return `Latest gas data is from ${observedAt}. Grid checks every hour.`;
}

export function gasPartialText(start: string, latestAt: string): string {
  return `This gas day is not complete. Figures cover ${start} to ${latestAt}. Compare with past days on the same basis.`;
}

/** Terminal entry. The country of production is not part of the label. */
export function entryAtTerminal(terminal: string): string {
  return `Entry at ${terminal}`;
}

const BANNED_PATTERNS: readonly { pattern: RegExp; allow?: readonly string[] }[] = [
  { pattern: /real-time/i },
  { pattern: /realtime/i },
  { pattern: /right now/i },
  { pattern: /\blive\b/i, allow: [GAS_LDZ_NOTE] },
  { pattern: /\bUK\b/ },
  { pattern: /days of gas left/i },
  { pattern: /% full/i },
  { pattern: /\bTTF\b/ },
  { pattern: /\bNorway\b/ },
  { pattern: /\bNetherlands\b/ },
  { pattern: /\bBelgium\b/ },
  { pattern: /\bQatar\b/ },
];

export function bannedGasPhrases(text: string): string[] {
  const hits: string[] = [];
  for (const rule of BANNED_PATTERNS) {
    const stripped = (rule.allow ?? []).reduce((current, sentence) => current.split(sentence).join(""), text);
    if (rule.pattern.test(stripped)) {
      hits.push(rule.pattern.source);
    }
  }
  return hits;
}
