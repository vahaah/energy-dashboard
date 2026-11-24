import { visibleDatasetId } from "@/lib/data-health-list";
import { ABSENT_FIGURE, DATA_STATE_LABEL, type DataState } from "@/lib/data-state";
import type { DataHealthReading } from "@/lib/data-health";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function badge(state: DataState | null): string {
  if (state == null) {
    return `<span class="dh-badge">Current</span>`;
  }
  return `<span class="dh-badge" data-state="${state}">${escapeHtml(DATA_STATE_LABEL[state])}</span>`;
}

function figure(reading: DataHealthReading): string {
  if (reading.value_label === ABSENT_FIGURE) {
    const reason = reading.state === "not_yet_available" ? "Not yet available" : "Not published";
    return `<span data-absent="true" aria-label="${escapeHtml(reason)}">${ABSENT_FIGURE}</span>`;
  }
  return `<span data-value>${escapeHtml(reading.value_label)}</span><span data-unit class="unit-label dh-unit">\u2009${escapeHtml(reading.unit)}</span>`;
}

function clock(kind: "published" | "retrieved", value: string | null, label: string): string {
  const stamp = value ? ` datetime="${escapeHtml(value)}"` : "";
  return `<time data-clock="${kind}"${stamp} class="text-mono-12">${escapeHtml(label)}</time>`;
}

/** One reading as HTML. The long lists use this so the flight payload is not a React node per row. */
export function healthReadingHtml(reading: DataHealthReading): string {
  const meta = [reading.source, visibleDatasetId(reading.dataset_id), reading.expected_cadence]
    .filter((part) => part != null && part !== "")
    .join(" · ");
  const lag = reading.publication_lag_label
    ? `<p class="dh-lag">${escapeHtml(reading.publication_lag_label)}</p>`
    : "";
  return `<div class="dh-reading"><p class="dh-label">${escapeHtml(reading.label)}</p>${badge(reading.state)}<p class="dh-meta">${escapeHtml(meta)}</p><p class="dh-figure" data-figure>${figure(reading)}</p><p class="dh-times">Published ${clock("published", reading.published_at, reading.published_label)} · Retrieved ${clock("retrieved", reading.retrieved_at, reading.retrieved_label)}</p>${lag}</div>`;
}

export function healthReadingListHtml(readings: readonly DataHealthReading[]): string {
  return readings.map((reading) => `<li class="dh-row">${healthReadingHtml(reading)}</li>`).join("");
}
