import { ELEXON_BMRS_LICENCE_URL, NESO_OPEN_DATA_ATTRIBUTION, NESO_OPEN_DATA_LICENCE_URL } from "@/lib/attribution";

export const NESO_DAILY_BALANCING_URL =
  "https://www.neso.energy/data-portal/daily-balancing-costs-balancing-services-use-system";

export const NESO_BSUOS_TARIFF_URL = "https://www.neso.energy/data-portal/bsuos-fixed-tariffs";

export const NESO_BALANCING_COSTS_URL = "https://www.neso.energy/industry-information/balancing-costs";

export const NESO_BALANCING_BLOG_URL = "https://www.neso.energy/news/balancing-act";

export const NESO_BALANCING_BLOG_PART2_URL = "https://www.neso.energy/news/balancing-act-part-2-outturn";

/** NESO's own words for wind turn-down. Not this page's Constraints category. */
export const NESO_WIND_TURNDOWN = "a little under £0.5bn";

export const OFGEM_CAP_AND_FLOOR_URL =
  "https://www.ofgem.gov.uk/sites/default/files/2024-12/Interconnector_Cap_and_Floor_Regime_Handbook_Updated_Version.pdf";

export const HMRC_OTS_URL = "https://www.uktradeinfo.com/trade-data/ots-custom-table/";

export const DUKES_CHAPTER_5_URL =
  "https://assets.publishing.service.gov.uk/media/6aba96e8997a4b2950ccf02c/DUKES_2026_Chapter_5.pdf";

export const BALANCING_TITLE = "GB grid balancing costs and BSUoS | Grid";

export const BALANCING_DESCRIPTION =
  "Daily GB balancing cost from NESO, the BSUoS charge per household with its assumptions, and a separate estimate of interconnector trade value.";

export const BALANCING_H1 = "What does it cost to keep Britain's electricity in balance?";

export const BALANCING_STANDFIRST =
  "What NESO spends each day to keep Great Britain's electricity supply matched to demand, and who pays. A separate estimate of interconnector trade sits below; it is not part of the balancing cost.";

export const BALANCING_PATH = "/system/balancing";

export const TRADE_TITLE = "Estimated value of electricity traded with GB's neighbours";

export const TRADE_LABEL =
  "Estimate: half-hourly flow × Market index price (Elexon MID). Not an invoice, and not part of the balancing cost.";

export const TRADE_ESTIMATE_BADGE = "Estimate";

export const NESO_BALANCING_HEADLINE = "£3.1 billion";

export const NESO_BALANCING_HEADLINE_YEAR = "2025/26";

export const NESO_BALANCING_SOURCE = "NESO (balancing)";

export const BALANCING_ATTRIBUTION = `${NESO_OPEN_DATA_ATTRIBUTION}. ${NESO_OPEN_DATA_LICENCE_URL}`;

export const TRADE_ATTRIBUTION = `Contains BMRS data © Elexon Limited copyright and database right. ${ELEXON_BMRS_LICENCE_URL}`;

export const BALANCING_TINYBIRD_OPS = 0;

export const BALANCING_FAQS = [
  {
    question: "What is balancing?",
    answer:
      "Electricity is bought and sold as if the network could carry power anywhere in Great Britain without limit. It can't. From one hour before each half-hour (gate closure), NESO pays generators and users to change what they planned, so that supply matches demand and no line is overloaded.",
  },
  {
    question: "Who pays the balancing cost?",
    answer:
      "NESO recovers it through BSUoS (Balancing Services Use of System), a charge in £/MWh that electricity suppliers pay and pass on in bills. NESO sets it each December for the following April to March. NESO puts balancing at 4.3% of a typical household electricity bill in 2025/26.",
  },
  {
    question: "Is the interconnector figure a bill?",
    answer:
      "No. Grid multiplies each half-hour's flow by the Market index price (Elexon MID). The traders who use the cables settle the actual payments. It is an estimate, not an invoice, and it is never added to the balancing cost.",
  },
] as const;
