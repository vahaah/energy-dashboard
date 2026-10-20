import type { TodayFigures } from "@/lib/map/today-figures";

export const TODAY_MAP_TITLE = "Power infrastructure in GB";

export const TODAY_MAP_SUMMARY = "What is built and what is in the pipeline, from the public registers.";

export const TODAY_MAP_SCOPE = "England, Scotland and Wales.";

export const TODAY_MAP_CONSENT = "Consent does not mean a project will be built.";

export const TODAY_MAP_PIPELINE_UNFILTERED = "Pipeline figures are not yet filtered to GB.";

export function missingCapacitySentence(count: number, noun: "site" | "project"): string {
  const label = count === 1 ? noun : `${noun}s`;
  return `Rated capacity is not published for ${count.toLocaleString("en-GB")} ${label}. The gigawatts are the published total.`;
}

export const TODAY_MAP_OPEN = "Open map →";

export const TODAY_MAP_LIST = "View as list";

export const TODAY_MAP_PIPELINE = "Pipeline";

export const TODAY_MAP_BANNED_PHRASES = ["live map", "digital twin", "power flows"] as const;

export const TODAY_MAP_MAX_BYTES = 25 * 1024;

/** Widest map box. The PNG is this wide, times {@link TODAY_MAP_SCALE}. */
export const TODAY_MAP_CSS_WIDTH = 264;

export const TODAY_MAP_SCALE = 2;

export const TODAY_MAP_PAD_RATIO = 0.045;

export const TODAY_MAP_PADDING_PX = 12;

export const TODAY_MAP_LIGHT_PATH = "/today/map-light.png";

export const TODAY_MAP_DARK_PATH = "/today/map-dark.png";

export const REPD_STALE_MONTHS = 4;

export const DUKES_STALE_MONTHS = 14;

export type TodayMapStamp = {
  repd_source_release_id: string;
  dukes_source_release_id: string;
  dno_sha256: string;
  batteries_sha256: string;
  /** sha256 of data/catalogue/energy_projects.ndjson. Pipeline figures read that file. */
  projects_sha256: string;
};

export type TodayMapCount = {
  id: string;
  gw: string | null;
  sites: number;
};

export type TodayMapCardFile = TodayMapStamp & {
  edition: string;
  repd_quarter_end: string | null;
  dukes_published_on: string | null;
  width: number;
  height: number;
  light: string;
  dark: string;
  alt: string;
  availability: TodayFigures["availability"];
  operating: { gw: string | null; sites: number | null; missing: number };
  technologies: TodayMapCount[];
  nations: TodayMapCount[];
  pipeline: {
    gw: string | null;
    sites: number | null;
    missing: number;
    filtered: boolean;
    stages: TodayMapCount[];
  };
};

export function todayMapAlt(sites: number, gw: string, largest: readonly string[]): string {
  const names = largest.map((label, index) => (index === 0 ? label : lowerFirst(label)));
  const ranking =
    names.length >= 3 ? `${names[0]}, ${names[1]} and ${names[2]} are the largest by capacity.` : "";
  return `Map of Great Britain showing ${sites.toLocaleString("en-GB")} operating power sites, ${gw} GW in total. ${ranking}`.trim();
}

function lowerFirst(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toLowerCase() + value.slice(1);
}

export function registerEditionLabel(repdEdition: string, dukesEdition: string): string {
  const dukes = dukesEdition.startsWith("DUKES ") ? dukesEdition : `DUKES ${dukesEdition}`;
  return `${repdEdition} · ${dukes}`;
}

export function repdQuarterEnd(edition: string): string | null {
  const match = /Q([1-4])\s+(\d{4})/.exec(edition);
  const quarter = match?.[1];
  const year = match?.[2];
  if (!quarter || !year) {
    return null;
  }
  const ends = ["03-31", "06-30", "09-30", "12-31"];
  return `${year}-${ends[Number(quarter) - 1]}`;
}

export function addCalendarMonths(day: string, months: number): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }
  const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + months, Number(match[3])));
  if (Number.isNaN(shifted.getTime())) {
    return null;
  }
  return shifted.toISOString().slice(0, 10);
}

export type RegisterFreshness = {
  repdStale: boolean;
  dukesStale: boolean;
  stale: boolean;
};

/**
 * REPD is stale more than four months after the quarter ends.
 * DUKES is stale more than fourteen months after publication.
 * A missing date is stale.
 */
export function registerFreshness(
  input: { repdQuarterEnd: string | null; dukesPublishedOn: string | null },
  now: Date,
): RegisterFreshness {
  const today = now.toISOString().slice(0, 10);
  const repdLimit = input.repdQuarterEnd ? addCalendarMonths(input.repdQuarterEnd, REPD_STALE_MONTHS) : null;
  const dukesLimit = input.dukesPublishedOn ? addCalendarMonths(input.dukesPublishedOn, DUKES_STALE_MONTHS) : null;
  const repdStale = repdLimit === null || today > repdLimit;
  const dukesStale = dukesLimit === null || today > dukesLimit;
  return { repdStale, dukesStale, stale: repdStale || dukesStale };
}

export function todayMapReleaseCurrent(stamp: TodayMapStamp, next: TodayMapStamp): boolean {
  return (
    stamp.repd_source_release_id === next.repd_source_release_id &&
    stamp.dukes_source_release_id === next.dukes_source_release_id &&
    stamp.dno_sha256 === next.dno_sha256 &&
    stamp.batteries_sha256 === next.batteries_sha256 &&
    stamp.projects_sha256 === next.projects_sha256
  );
}

export function containsBannedTodayMapPhrase(text: string): boolean {
  const folded = text.toLowerCase();
  return TODAY_MAP_BANNED_PHRASES.some((phrase) => folded.includes(phrase));
}

export function formatTodayCount(count: number | null): string | null {
  if (count === null) {
    return null;
  }
  return count.toLocaleString("en-GB");
}
