import { OGL_V3_ATTRIBUTION } from "@/lib/attribution";

export const PIPELINE_PATH = "/pipeline";

export const PIPELINE_TITLE = "GB renewable and storage project pipeline | Grid";

export const PIPELINE_DESCRIPTION =
  "Renewable and storage projects in Great Britain, from planning to construction, by stage and technology. From DESNZ's REPD, updated quarterly.";

export const PIPELINE_H1 = "What's in GB's pipeline of new energy projects?";

export const PIPELINE_EYEBROW = "Pipeline";

export const PIPELINE_CREDIT = "Data: DESNZ REPD via Grid";

export const PIPELINE_SOURCE_LINE = `${PIPELINE_CREDIT}. ${OGL_V3_ATTRIBUTION}`;

export const PIPELINE_NOT_UPDATED = "Not updated";

export const PIPELINE_STALE_DAYS = 120;

export const PIPELINE_EXPLAINER_LABEL = "How the pipeline works";

export const PIPELINE_MEDIAN_NOTE = "Only projects that finished this step are counted.";

export const PIPELINE_NOT_PUBLISHED = "Not published";

export const PIPELINE_EXCLUDED =
  "Revised records and records with no application required are left out. Operating plant, plant that is not going ahead, and decommissioned plant are outside this total.";

export const PIPELINE_CSV_PATH = "/pipeline/projects.csv";

export const NI_PIPELINE_HREF = "/electricity/northern-ireland";

export type ExplainerSection = {
  title: string;
  body: string;
};

export const PIPELINE_EXPLAINER: readonly ExplainerSection[] = [
  {
    title: "Under construction",
    body: "DESNZ has recorded a construction start, and the project is not operational. These projects are in the pipeline.",
  },
  {
    title: "Consented, awaiting construction",
    body: "Planning permission has been granted and construction has not started. Consent does not mean the project will be built.",
  },
  {
    title: "In planning",
    body: "An application has been submitted, or an appeal has been lodged, and DESNZ has not recorded a decision.",
  },
  {
    title: "Refusals",
    body: "The planning authority or an appeal refused permission. Refused projects are not going ahead, so they are outside the pipeline.",
  },
  {
    title: "Withdrawals",
    body: "The applicant withdrew the application or the appeal. Withdrawn projects are outside the pipeline.",
  },
  {
    title: "Appeals",
    body: "An appeal that is still lodged stays in planning. A decided appeal moves the project to consented, refused, or withdrawn.",
  },
  {
    title: "Call-ins",
    body: "The Secretary of State can take the decision. A grant is consented. A refusal is not going ahead.",
  },
  {
    title: "Abandonment",
    body: "DESNZ records the project as abandoned. Abandoned projects are outside the pipeline, including where permission had been granted.",
  },
  {
    title: "Expiry",
    body: "Planning permission expired before construction. Expired permissions are outside the pipeline.",
  },
];

export const PIPELINE_METHODOLOGY = [
  "Figures are from the DESNZ Renewable Energy Planning Database, July 2026 (Q2), published 3 August 2026, under the Open Government Licence v3.0. Great Britain is England, Scotland and Wales. Northern Ireland is counted on its own card and is not added to the GB total.",
  "Status text is trimmed and compared case-insensitively. Revised records are left out, because a newer application replaces them. Records with no application required are left out of the pipeline. Operational plant and decommissioned plant are outside it. Refused, withdrawn, abandoned and expired records are grouped as not going ahead.",
  "A project with no rated capacity is counted and shown as Not published. It is not treated as 0 MW. Displayed gigawatts use largest-remainder rounding at 0.1 GW, so the parts add up to the shown total. Battery and other storage (pumped storage, liquid air, compressed air and flywheels) are split out of the same total. The remainder is generation.",
  "The 2015–2020 group is GB applications with a submitted date in those years, excluding revised records and records with no application required. Consented means a grant date is recorded, or the project is already under construction or operating. Built means under construction or operating. Medians use only projects that finished the step: a planning decision, a move out of the consented wait, or an operational date after construction.",
] as const;
