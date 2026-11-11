/**
 * Ofgem's typical medium household uses 2,700 kWh of electricity a year.
 * https://www.ofgem.gov.uk/information-consumers/energy-advice-households/average-gas-and-electricity-use-explained
 * BSUoS is £/MWh. 2,700 kWh = 2.7 MWh. Losses and VAT are not included.
 */
export const TYPICAL_HOUSEHOLD_KWH = 2_700;

export const HOUSEHOLD_METHOD =
  "Current final BSUoS tariff × 2,700 kWh, Ofgem's typical medium household. Before losses and VAT. A household bill also contains other charges.";

export function householdPence(tariffGbpPerMwh: number): number {
  if (!Number.isFinite(tariffGbpPerMwh)) {
    throw new Error("tariff must be finite");
  }
  const tariffPencePerMwh = Math.round(tariffGbpPerMwh * 100);
  return Math.round((tariffPencePerMwh * TYPICAL_HOUSEHOLD_KWH) / 1_000);
}
