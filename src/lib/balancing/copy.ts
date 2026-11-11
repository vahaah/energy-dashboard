import { NESO_OPEN_DATA_ATTRIBUTION, NESO_OPEN_DATA_LICENCE_URL, ELEXON_BMRS_LICENCE_URL } from "@/lib/attribution";

export const NESO_DAILY_BALANCING_URL =
  "https://api.neso.energy/dataset/daily-balancing-costs-balancing-services-use-of-system";

export const NESO_BSUOS_TARIFF_URL = "https://www.neso.energy/data-portal/bsuos-fixed-tariffs";

export const NESO_BALANCING_COSTS_URL = "https://www.neso.energy/industry-information/balancing-costs";

export const OFGEM_INTERCONNECTORS_URL =
  "https://www.ofgem.gov.uk/energy-policy-and-regulation/policy-and-regulatory-programmes/interconnectors";

export const OFGEM_TYPICAL_USE_URL =
  "https://www.ofgem.gov.uk/information-consumers/energy-advice-households/average-gas-and-electricity-use-explained";

export const DUKES_CHAPTER_5_URL =
  "https://assets.publishing.service.gov.uk/media/6aba96e8997a4b2950ccf02c/DUKES_2026_Chapter_5.pdf";

export const BALANCING_TITLE = "What it costs to balance Britain's grid | Grid";

export const BALANCING_DESCRIPTION =
  "NESO's daily balancing cost by category, the BSUoS tariff, a per-household estimate, and a separate estimate of electricity traded with neighbouring countries.";

export const BALANCING_H1 = "What does it cost to keep Britain's electricity in balance?";

export const BALANCING_STANDFIRST =
  "Daily balancing cost from NESO, and a separate estimate of electricity traded with neighbouring countries. The estimate is not part of the balancing cost.";

export const BALANCING_PATH = "/system/balancing";

export const TRADE_TITLE = "Estimated value of electricity traded with our neighbours";

export const TRADE_LABEL =
  "Estimated value of electricity traded with our neighbours: flow × GB market price, an estimate, not an invoice";

export const TRADE_ESTIMATE_BADGE = "Estimate";

export const NESO_MBSS_HEADLINE = "£3.1 billion";

export const NESO_MBSS_YEAR = "2025/26";

export const BALANCING_ATTRIBUTION = `${NESO_OPEN_DATA_ATTRIBUTION}. ${NESO_OPEN_DATA_LICENCE_URL}`;

export const TRADE_ATTRIBUTION = `Contains BMRS data © Elexon Limited copyright and database right. ${ELEXON_BMRS_LICENCE_URL}`;

export const BALANCING_TINYBIRD_OPS = 0;

export const BALANCING_FAQS = [
  {
    question: "What is balancing?",
    answer:
      "The wholesale market trades as if one national copper plate could carry power anywhere. From an hour before delivery, NESO adjusts plants so supply equals demand and no line overloads.",
  },
  {
    question: "Who pays the balancing cost?",
    answer:
      "NESO recovers it through BSUoS, a tariff in £/MWh fixed about six months ahead. Suppliers pass that charge into bills. NESO puts it at about 4.3% of a typical household bill.",
  },
  {
    question: "Is the interconnector figure a bill?",
    answer:
      "No. It is half-hourly flow times the GB market price. Traders settle the power. It is an estimate, not an invoice, and it is not added to the balancing cost.",
  },
] as const;
