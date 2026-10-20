const COMPACT = /^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/;

export type ParsedPostcode = {
  outward: string;
  inward: string;
  normalised: string;
};

/** Upper case, no spaces. Null when the string is not a UK postcode. */
export function normalizePostcode(input: string): ParsedPostcode | null {
  const compact = input.trim().toUpperCase().replace(/\s+/g, "");
  const match = COMPACT.exec(compact);
  const outward = match?.[1];
  const inward = match?.[2];
  if (!outward || !inward) {
    return null;
  }
  return { outward, inward, normalised: `${outward}${inward}` };
}

export function splitNormalised(normalised: string): ParsedPostcode | null {
  return normalizePostcode(normalised);
}
