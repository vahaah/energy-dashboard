import { getLondonDateTimeParts, parseUtcDateTime } from "@/lib/london-time";

/** Missing figures. Never coerce a gap to 0. */
export const ABSENT_FIGURE = "—";

export const DATA_STATES = [
  "loading",
  "partial",
  "stale",
  "unavailable",
  "revised",
  "provisional",
  "forecast",
  "not_yet_available",
] as const;

export type DataState = (typeof DATA_STATES)[number];

export const DATA_STATE_LABEL: Record<DataState, string> = {
  loading: "Loading",
  partial: "Partial",
  stale: "Stale",
  unavailable: "Unavailable",
  revised: "Revised",
  provisional: "Provisional",
  forecast: "Forecast",
  not_yet_available: "Not yet available",
};

export type PublicationMark = "revised" | "provisional" | "forecast" | "partial" | "unavailable";

const CADENCE_RE =
  /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

export function formatAbsent(
  value: number | null | undefined,
  format: (value: number) => string = (number) => String(number)
): string {
  if (value == null || !Number.isFinite(value)) {
    return ABSENT_FIGURE;
  }
  return format(value);
}

export function formatHealthClock(iso: string | null): string {
  if (!iso) {
    return ABSENT_FIGURE;
  }
  const date = parseUtcDateTime(iso);
  if (Number.isNaN(date.getTime())) {
    return ABSENT_FIGURE;
  }
  const parts = getLondonDateTimeParts(date);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

/** Deadline after `from`. Null when the cadence is not an ISO-8601 duration. */
export function cadenceDeadline(from: Date, cadence: string): Date | null {
  const match = CADENCE_RE.exec(cadence);
  if (!match) {
    return null;
  }
  const years = Number(match[1] ?? 0);
  const months = Number(match[2] ?? 0);
  const weeks = Number(match[3] ?? 0);
  const days = Number(match[4] ?? 0);
  const hours = Number(match[5] ?? 0);
  const minutes = Number(match[6] ?? 0);
  const seconds = Number(match[7] ?? 0);
  if (years + months + weeks + days + hours + minutes + seconds === 0) {
    return null;
  }
  const next = new Date(from.getTime());
  if (years) {
    next.setUTCFullYear(next.getUTCFullYear() + years);
  }
  if (months) {
    next.setUTCMonth(next.getUTCMonth() + months);
  }
  if (weeks) {
    next.setUTCDate(next.getUTCDate() + weeks * 7);
  }
  if (days) {
    next.setUTCDate(next.getUTCDate() + days);
  }
  if (hours) {
    next.setUTCHours(next.getUTCHours() + hours);
  }
  if (minutes) {
    next.setUTCMinutes(next.getUTCMinutes() + minutes);
  }
  if (seconds) {
    next.setUTCSeconds(next.getUTCSeconds() + seconds);
  }
  return next;
}

export function isBeyondCadence(publishedAt: string, now: Date, cadence: string): boolean {
  const published = parseUtcDateTime(publishedAt);
  if (Number.isNaN(published.getTime())) {
    return false;
  }
  const deadline = cadenceDeadline(published, cadence);
  if (!deadline) {
    return false;
  }
  return now.getTime() > deadline.getTime();
}

export type PublicationAssessment = {
  stale: boolean;
  state: DataState | null;
  valueLabel: string;
  publishedLabel: string;
  retrievedLabel: string;
};

export function assessPublication(input: {
  value: number | null;
  publishedAt: string | null;
  retrievedAt: string | null;
  expectedCadence: string;
  now: Date;
  publicationStatus?: PublicationMark | null;
  formatValue?: (value: number) => string;
}): PublicationAssessment {
  const publishedLabel = input.expectedCadence.startsWith("PT")
    ? formatHealthClock(input.publishedAt)
    : formatHealthDate(input.publishedAt);
  const retrievedLabel = formatHealthClock(input.retrievedAt);
  const valueLabel = formatAbsent(input.value, input.formatValue);

  if (input.value == null || !Number.isFinite(input.value)) {
    return {
      stale: false,
      state: "not_yet_available",
      valueLabel,
      publishedLabel,
      retrievedLabel,
    };
  }

  const stale =
    input.publishedAt != null &&
    isBeyondCadence(input.publishedAt, input.now, input.expectedCadence);

  if (stale) {
    return { stale: true, state: "stale", valueLabel, publishedLabel, retrievedLabel };
  }

  const marked = input.publicationStatus ?? null;
  return {
    stale: false,
    state: marked,
    valueLabel,
    publishedLabel,
    retrievedLabel,
  };
}

function formatHealthDate(iso: string | null): string {
  if (!iso) {
    return ABSENT_FIGURE;
  }
  const date = parseUtcDateTime(iso);
  if (Number.isNaN(date.getTime())) {
    return ABSENT_FIGURE;
  }
  const parts = getLondonDateTimeParts(date);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
  return `${parts.day} ${months[parts.month - 1]} ${parts.year}`;
}
