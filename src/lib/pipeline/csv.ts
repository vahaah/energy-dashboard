import type { PipelineTableRow } from "@/lib/pipeline/model";
import { stageLabel } from "@/lib/pipeline/model";

const HEADERS = ["name", "stage", "technology", "nation", "capacity_mw", "status_date", "repd_ref", "asset_path"] as const;

function cell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function pipelineCsv(rows: readonly PipelineTableRow[]): string {
  const lines = [HEADERS.join(",")];
  for (const row of rows) {
    lines.push(
      [
        cell(row.name),
        cell(stageLabel(row.stage)),
        cell(row.technologyLabel),
        cell(row.nation),
        row.mw === null ? "" : String(row.mw),
        row.statusDate ?? "",
        cell(row.ref),
        row.href ?? "",
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}
