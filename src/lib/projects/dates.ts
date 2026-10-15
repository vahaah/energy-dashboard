const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function parseUkDate(value: string): string | null {
  const trimmed = value.replace(/\u00a0/g, " ").trim();
  if (trimmed.length === 0) {
    return null;
  }
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }
  return isoDate(Number(match[3]), Number(match[2]), Number(match[1]));
}

export function parseIsoDate(value: string): string | null {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }
  return isoDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

function isoDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) {
    return null;
  }
  return iso;
}

export function latestDate(dates: readonly (string | null)[]): string | null {
  let latest: string | null = null;
  for (const date of dates) {
    if (date && (latest === null || date > latest)) {
      latest = date;
    }
  }
  return latest;
}

export function earliestDate(dates: readonly (string | null)[]): string | null {
  let earliest: string | null = null;
  for (const date of dates) {
    if (date && (earliest === null || date < earliest)) {
      earliest = date;
    }
  }
  return earliest;
}

/** The next published expectation on or after `asOf`, otherwise the latest date. */
export function expectedEnergisation(dates: readonly (string | null)[], asOf: string): string | null {
  const real = dates.filter((date): date is string => date !== null).sort();
  const upcoming = real.find((date) => date >= asOf);
  if (upcoming) {
    return upcoming;
  }
  return real.at(-1) ?? null;
}

export function formatProjectDate(iso: string | null, empty: string): string {
  if (!iso) {
    return empty;
  }
  const [year, month, day] = iso.split("-");
  const label = MONTHS[Number(month) - 1];
  if (!year || !day || !label) {
    return empty;
  }
  return `${Number(day)} ${label} ${year}`;
}
