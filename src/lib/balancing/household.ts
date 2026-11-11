/**
 * Ofgem's medium typical domestic consumption value is 2,500 kWh a year from 1 Jul 2026.
 * https://www.ofgem.gov.uk/sites/default/files/2026-05/Review%20of%20typical%20domestic%20consumption%20values%20decision.pdf
 * BSUoS is £/MWh. 2,500 kWh = 2.5 MWh. Losses are left out. The figure excludes VAT.
 */
export const TYPICAL_HOUSEHOLD_KWH = 2_500;

export const OFGEM_TDCV_URL =
  "https://www.ofgem.gov.uk/sites/default/files/2026-05/Review%20of%20typical%20domestic%20consumption%20values%20decision.pdf";

export const HOUSEHOLD_METHOD =
  "Current BSUoS tariff × 2,500 kWh, Ofgem's typical yearly electricity use for a medium household from 1 Jul 2026. It leaves out network losses. Excluding VAT. A real bill depends on how much electricity the home uses.";

export function householdPence(tariffGbpPerMwh: number): number {
  if (!Number.isFinite(tariffGbpPerMwh)) {
    throw new Error("tariff must be finite");
  }
  const tariffPencePerMwh = Math.round(tariffGbpPerMwh * 100);
  return Math.round((tariffPencePerMwh * TYPICAL_HOUSEHOLD_KWH) / 1_000);
}
