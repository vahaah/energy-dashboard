import type { DataHealthReading } from "@/lib/data-health";

const DATASET_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Dataset codes stay visible. A publisher UUID does not. */
export function visibleDatasetId(datasetId: string): string | null {
  if (DATASET_UUID.test(datasetId)) {
    return null;
  }
  return datasetId;
}

export type HealthSeriesGroups = {
  current: DataHealthReading[];
  notUpdated: DataHealthReading[];
  missing: DataHealthReading[];
  other: DataHealthReading[];
};

export function groupHealthReadings(readings: readonly DataHealthReading[]): HealthSeriesGroups {
  const current: DataHealthReading[] = [];
  const notUpdated: DataHealthReading[] = [];
  const missing: DataHealthReading[] = [];
  const other: DataHealthReading[] = [];
  for (const reading of readings) {
    if (reading.state == null) {
      current.push(reading);
    } else if (reading.state === "stale") {
      notUpdated.push(reading);
    } else if (reading.state === "not_yet_available" || reading.state === "unavailable") {
      missing.push(reading);
    } else {
      other.push(reading);
    }
  }
  return { current, notUpdated, missing, other };
}

export function healthSeriesSummary(groups: HealthSeriesGroups): string {
  const parts = [
    `${groups.current.length} current`,
    `${groups.notUpdated.length} not updated`,
    `${groups.missing.length} missing`,
  ];
  if (groups.other.length > 0) {
    parts.push(`${groups.other.length} marked`);
  }
  return parts.join(", ");
}
