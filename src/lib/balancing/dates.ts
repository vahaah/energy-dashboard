export function formatBalancingDate(iso: string, withYear = true): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) {
    return iso;
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" as const } : {}),
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatMissingDays(dates: readonly string[]): string | null {
  if (dates.length === 0) {
    return null;
  }
  const labels = dates.map((date) => formatBalancingDate(date, false));
  if (dates.length === 1) {
    return `1 day missing from NESO's file (${labels[0]}).`;
  }
  return `${dates.length} days missing from NESO's file (${labels.join(", ")}).`;
}
