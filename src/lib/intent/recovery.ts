/**
 * Official enquiry pages checked on 24 November 2026.
 * Find My Supplier, the National Grid distribution checker and the DESNZ,
 * NESO and Elexon pages returned HTTP 200. The UK Power Networks form
 * loaded in a browser (the same URL is 403 to a bare script). ECOES
 * (ecoes.co.uk) is an industry login and is not linked.
 */
export const FIND_MY_SUPPLIER_URL = "https://www.findmysupplier.energy/";
export const UKPN_MPAN_URL = "https://www.ukpowernetworks.co.uk/who-is-my-electricity-supplier-and-what-is-my-mpan";
export const NGED_MPAN_URL = "https://connections.nationalgrid.co.uk/what-is-my-mpan-number";
export const REPD_EXTRACT_URL =
  "https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract";
export const TEC_REGISTER_URL = "https://www.neso.energy/data-portal/transmission-entry-capacity-tec-register";
export const BMRS_URL = "https://bmrs.elexon.co.uk/";
export const ELEXON_ISD_URL = "https://www.elexon.co.uk/bsc/data/industry-standing-data/";

export const METER_HOLDS_NOTHING =
  "Grid does not hold these numbers, look them up, or pass a number on to those services.";
export const MPID_IS_NOT_MPAN =
  "An MPID in the directory is a settlement code for an organisation. It is not an MPAN.";
export const METER_SERIAL_LINE =
  "The meter serial number is printed on the meter. There is no public serial-number database here.";
export const ECOES_NOT_PUBLIC =
  "The Electricity Enquiry Service (ECOES) is an industry login, not a public search.";
export const OTHER_NETWORK_LINE =
  "For any other electricity network, use the Energy Networks Association operator search and ask that operator or your supplier. The MPAN is on the electricity bill.";

export type RecoveryLink = {
  href: string;
  label: string;
  note: string;
};

export const METER_ENQUIRY_LINKS: readonly RecoveryLink[] = [
  {
    href: FIND_MY_SUPPLIER_URL,
    label: "Find My Supplier",
    note: "Xoserve. Gas supplier, MPRN and gas transporter for an address.",
  },
  {
    href: UKPN_MPAN_URL,
    label: "UK Power Networks supplier and MPAN form",
    note: "London, the South East and the East of England.",
  },
  {
    href: NGED_MPAN_URL,
    label: "National Grid distribution MPAN checker",
    note: "Postcode checker for that distribution company. It does not cover every address in Britain.",
  },
];

export const LIVE_MIX_PROMPT = "Looking for the live mix or the wholesale price?";
