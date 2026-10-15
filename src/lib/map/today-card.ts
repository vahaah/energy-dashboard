export const TODAY_MAP_TITLE = "Map of published infrastructure";

export const TODAY_MAP_SUMMARY =
  "Power stations, renewables and storage in Great Britain, from published sources.";

export const TODAY_MAP_LINK = "View on map";

export const TODAY_MAP_BANNED_PHRASES = ["live map", "digital twin", "power flows"] as const;

export const TODAY_MAP_MAX_BYTES = 150 * 1024;

export const TODAY_MAP_HEIGHT = 720;

export const TODAY_MAP_PAD_RATIO = 0.045;

export const TODAY_MAP_POINT_RADIUS = 3.2;

export const TODAY_MAP_PADDING_PX = 10;

export const TODAY_MAP_LIGHT_PATH = "/today/map-light.png";

export const TODAY_MAP_DARK_PATH = "/today/map-dark.png";

export type TodayMapStamp = {
  repd_source_release_id: string;
  dukes_source_release_id: string;
  dno_sha256: string;
};

export type TodayMapCardFile = TodayMapStamp & {
  edition: string;
  count: number;
  width: number;
  height: number;
  light: string;
  dark: string;
  alt: string;
};

export function todayMapAlt(count: number): string {
  return `Map of Great Britain showing ${count.toLocaleString("en-GB")} power stations, renewable and storage sites from published sources.`;
}

export function todayMapEditionLine(edition: string): string {
  return `Register edition ${edition}`;
}

export function registerEditionLabel(repdEdition: string, dukesEdition: string): string {
  const dukes = dukesEdition.startsWith("DUKES ") ? dukesEdition : `DUKES ${dukesEdition}`;
  return `${repdEdition} · ${dukes}`;
}

export function todayMapPointRadius(mw: number | null): number {
  const base = TODAY_MAP_POINT_RADIUS;
  if (mw === null || mw <= 0) {
    return base;
  }
  return Math.min(base * 2.5, base + Math.sqrt(mw) / 16);
}

export function todayMapReleaseCurrent(stamp: TodayMapStamp, next: TodayMapStamp): boolean {
  return (
    stamp.repd_source_release_id === next.repd_source_release_id &&
    stamp.dukes_source_release_id === next.dukes_source_release_id &&
    stamp.dno_sha256 === next.dno_sha256
  );
}

export function containsBannedTodayMapPhrase(text: string): boolean {
  const folded = text.toLowerCase();
  return TODAY_MAP_BANNED_PHRASES.some((phrase) => folded.includes(phrase));
}
