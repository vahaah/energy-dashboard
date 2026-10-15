import { parseGasCsvTable } from "@/lib/ingest/national-gas/csv";
import { gasDayContaining, gasDayFromLabel, gasDayLabelFromWall, parseLondonWallTime, type GasDay } from "@/lib/ingest/national-gas/gas-day";
import type { NationalGasCatalogue } from "@/lib/ingest/national-gas/catalogue";
import {
  gasPublication,
  parentPublicationId,
  type GasPublication,
} from "@/lib/ingest/national-gas/publications";
import {
  quarantine,
  takeQuality,
  type GasBasis,
  type GasQuarantine,
  type GasQuantityKind,
} from "@/lib/ingest/national-gas/quantity";

export type GasObservation = {
  publication_id: string;
  metric_id: string;
  name: string;
  unit: string;
  quantity_kind: GasQuantityKind;
  basis: GasBasis;
  value: number | null;
  counts: boolean;
  gas_day: GasDay;
  applicable_at: string;
  published_at: string;
  forecast_issued_at: string | null;
  parent_publication_id: string | null;
};

export type GasParseResult = {
  observations: GasObservation[];
  quarantine: GasQuarantine[];
};

export function parseGasCsv(text: string, catalogue: NationalGasCatalogue): GasParseResult {
  const table = parseGasCsvTable(text);
  const quarantined: GasQuarantine[] = [];
  const byName = new Map(catalogue.rows.map((row) => [row.name, row]));
  const seenUnverified = new Set<string>();

  for (const column of table.unknownColumns) {
    quarantined.push(quarantine("unknown_column", null, column, null));
  }

  const observations: GasObservation[] = [];
  for (const row of table.rows) {
    const name = row["Data Item"] ?? "";
    const catalogueRow = byName.get(name);
    if (!catalogueRow) {
      quarantined.push(quarantine("unknown_publication", null, "Data Item", name));
      continue;
    }
    const publication = gasPublication(catalogueRow.publicationId);
    if (!publication) {
      quarantined.push(
        quarantine("unknown_publication", catalogueRow.publicationId, "publication_id", catalogueRow.publicationId),
      );
      continue;
    }
    const parsed = parseRow(row, publication, catalogueRow.unitOfMeasure, quarantined);
    if (!parsed) {
      continue;
    }
    observations.push(parsed);
    if (!publication.verified && !seenUnverified.has(publication.publication_id)) {
      seenUnverified.add(publication.publication_id);
      quarantined.push(
        quarantine("unverified_series", publication.publication_id, "quantity_kind", publication.quantity_kind),
      );
    }
  }

  return { observations, quarantine: quarantined };
}

function parseRow(
  row: Record<string, string>,
  publication: GasPublication,
  unit: string,
  quarantined: GasQuarantine[],
): GasObservation | null {
  const applicableAt = parseLondonWallTime(row["Applicable At"] ?? "");
  const publishedAt = parseLondonWallTime(row["Generated Time"] ?? "");
  if (!applicableAt || !publishedAt) {
    quarantined.push(
      quarantine(
        "unparsed_time",
        publication.publication_id,
        applicableAt ? "Generated Time" : "Applicable At",
        applicableAt ? (row["Generated Time"] ?? "") : (row["Applicable At"] ?? ""),
      ),
    );
    return null;
  }

  const gasDay = gasDayFor(publication, row["Applicable For"] ?? "", applicableAt, quarantined);
  if (!gasDay) {
    return null;
  }

  const rawValue = (row.Value ?? "").trim();
  let value: number | null;
  if (rawValue.length === 0) {
    value = null;
  } else {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      quarantined.push(quarantine("unparsed_value", publication.publication_id, "Value", rawValue));
      return null;
    }
    value = parsed;
  }

  const quality = takeQuality(row["Quality Indicator"] ?? "", publication.publication_id);
  if (!quality.ok) {
    quarantined.push(quality.quarantine);
  }

  const issued =
    publication.quantity_kind === "forecast" ? applicableAt.toISOString() : null;

  return {
    publication_id: publication.publication_id,
    metric_id: publication.metric_id,
    name: row["Data Item"] ?? "",
    unit,
    quantity_kind: publication.quantity_kind,
    basis: publication.basis,
    value,
    counts: publication.counts,
    gas_day: gasDay,
    applicable_at: applicableAt.toISOString(),
    published_at: publishedAt.toISOString(),
    forecast_issued_at: issued,
    parent_publication_id: parentPublicationId(publication.publication_id),
  };
}

function gasDayFor(
  publication: GasPublication,
  applicableFor: string,
  applicableAt: Date,
  quarantined: GasQuarantine[],
): GasDay | null {
  switch (publication.gas_day_from) {
    case "applicable_at":
      return gasDayContaining(applicableAt);
    case "applicable_for": {
      const label = gasDayLabelFromWall(applicableFor);
      if (!label) {
        quarantined.push(
          quarantine("unparsed_time", publication.publication_id, "Applicable For", applicableFor),
        );
        return null;
      }
      return gasDayFromLabel(label);
    }
    default: {
      const neverSource: never = publication.gas_day_from;
      return neverSource;
    }
  }
}
