import { DURATION_TOOLTIP } from "@/lib/assets/labels";

export const STORAGE_PATH = "/system/storage";
export const STORAGE_TITLE = "GB electricity storage: batteries and pumped hydro | Grid";
export const STORAGE_DESCRIPTION =
  "How much battery and pumped-hydro storage Great Britain has, what is operating and what pumped storage is doing, from DESNZ REPD, DUKES and Elexon.";
export const STORAGE_H1 = "How much electricity storage is there, and what is it doing?";
export const STORAGE_STANDFIRST = "Pumped storage and batteries, with the coverage of each figure shown.";
export const STORAGE_EYEBROW = "Storage";

export const RATED_CAPACITY = "Operating rated capacity";
export const ENERGY_CAPACITY = "Energy capacity";
export const NOMINAL_DURATION = "Nominal duration";
export { DURATION_TOOLTIP };

export const STORAGE_FLEET_COVERED = "Storage fleet covered";
export const STORAGE_COVERAGE_FOOTNOTE =
  "Elexon publishes national totals for transmission-connected pumped storage. The capacity shown is the operating pumped storage in the registers.";
export const STORAGE_NATIONAL_ONLY = "FUELINST publishes national totals only.";
export const STORAGE_BATTERIES_UNREPORTED = "Elexon does not report batteries separately.";

export const STORAGE_SIGN = "Positive values are discharge; negative are charging.";

export const INVENTORY_HEADING = "Inventory";
export const MONITORED_HEADING = "Monitored fleet";
export const DISCHARGING = "Discharging";
export const CHARGING = "Charging";

export const INVENTORY_INTRO =
  "DESNZ REPD and DUKES list pumped storage and batteries. A station that appears in both registers counts once, on the counted megawatts. Projects that are not operating stay out of the operating total.";

export const MONITORED_INTRO =
  "Elexon publishes national totals for transmission-connected pumped storage. The capacity shown is the operating pumped storage in the registers. These national totals are separate from the inventory.";

export const ENERGY_POWER_ONLY = "The registers publish rated power only.";

export const COVERAGE_HREF = "/data-health#storage";
export const SOURCES_HREF = "/data-sources";
