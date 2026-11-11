/** FUELHH INT* code to the neighbouring country. INTNESO is the residual bucket and is never counted. */
export const INTERCONNECTOR_COUNTRY: Record<string, string> = {
  INTFR: "France",
  INTIFA2: "France",
  INTELEC: "France",
  // Nine zero-MW rows on 2021-09-10 used this code before INTELEC.
  INTELE: "France",
  INTNEM: "Belgium",
  INTNED: "Netherlands",
  INTNSL: "Norway",
  INTVKL: "Denmark",
  INTEW: "Ireland",
  INTGRNL: "Ireland",
  INTIRL: "Northern Ireland",
};

export const EXCLUDED_INTERCONNECTOR_FUELS = new Set(["INTNESO"]);

export const COUNTRY_ORDER = [
  "France",
  "Belgium",
  "Netherlands",
  "Norway",
  "Denmark",
  "Ireland",
  "Northern Ireland",
] as const;

export function countryForFuel(fuelType: string): string | null {
  const code = fuelType.toUpperCase();
  if (!code.startsWith("INT")) {
    return null;
  }
  if (EXCLUDED_INTERCONNECTOR_FUELS.has(code)) {
    return null;
  }
  return INTERCONNECTOR_COUNTRY[code] ?? code;
}

export function compareCountries(left: string, right: string): number {
  const leftIndex = COUNTRY_ORDER.indexOf(left as (typeof COUNTRY_ORDER)[number]);
  const rightIndex = COUNTRY_ORDER.indexOf(right as (typeof COUNTRY_ORDER)[number]);
  const leftRank = leftIndex === -1 ? COUNTRY_ORDER.length : leftIndex;
  const rightRank = rightIndex === -1 ? COUNTRY_ORDER.length : rightIndex;
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  return left.localeCompare(right, "en-GB");
}
