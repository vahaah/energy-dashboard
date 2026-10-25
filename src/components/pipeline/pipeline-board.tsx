import type { ReactNode } from "react";
import Link from "next/link";
import { MarkerSwatch } from "@/components/marker-swatch";
import { PipelineChartBoundary } from "@/components/pipeline/chart-boundary";
import { PipelineExplainer } from "@/components/pipeline/pipeline-explainer";
import { PipelineTable } from "@/components/pipeline/pipeline-table";
import { Absent } from "@/components/ui/absent";
import { Card, CardLoading } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { OGL_V3_ATTRIBUTION, OGL_V3_LICENCE_URL } from "@/lib/attribution";
import { STAGE_COLORS } from "@/lib/pipeline/colors";
import {
  NI_PIPELINE_HREF,
  PIPELINE_CATALOGUE_UNAVAILABLE,
  PIPELINE_CREDIT,
  PIPELINE_EXCLUDED,
  PIPELINE_MEDIAN_NOTE,
  PIPELINE_METHODOLOGY,
  PIPELINE_NOT_PUBLISHED,
  PIPELINE_NOT_UPDATED,
  PIPELINE_STORAGE_HEADING,
  PIPELINE_STORAGE_TOTAL,
} from "@/lib/pipeline/copy";
import { displayedPercents } from "@/lib/display-rounding";
import { formatMedianDuration, stageLabel, type PipelineFigures, type StorageTotal } from "@/lib/pipeline/model";
import type { PipelinePreview } from "@/lib/pipeline/preview";

const NATION_COLOR = "#0d94d2";

export function PipelineBoard({
  figures,
  stamp,
  stale,
  unavailable = false,
  preview = null,
}: {
  figures: PipelineFigures;
  stamp: string;
  stale: boolean;
  unavailable?: boolean;
  preview?: PipelinePreview | null;
}) {
  const count = figures.projects.toLocaleString("en-GB");
  const maxNation = Math.max(0, ...figures.nations.map((row) => row.exactGw));
  const loading = preview === "loading";
  const chartFailed = preview === "chart";
  return (
    <div className="flex min-w-0 flex-col gap-4" data-pipeline-state={preview ?? "ready"}>
      <Card title="In the pipeline">
        <p className="break-words text-copy-14 text-gray-900" data-edition>
          {stamp}
        </p>
        {stale ? (
          <p role="status" className="mt-3 border-t-2 border-amber-700 pt-2 text-copy-14 text-gray-1000">
            {PIPELINE_NOT_UPDATED}
          </p>
        ) : null}
        {unavailable ? (
          <p className="mt-3 break-words text-copy-14 text-gray-900">{PIPELINE_CATALOGUE_UNAVAILABLE}</p>
        ) : null}
        <p className="mt-4 text-label-13 text-gray-900">Projects</p>
        <p data-figure className="font-sans text-heading-32 tabular-nums text-gray-1000">
          <span data-value>{count}</span>
        </p>
        <p className="mt-3 text-label-13 text-gray-900">Rated capacity</p>
        <p data-figure className="font-sans text-heading-32 tabular-nums text-gray-1000">
          <span data-value>{figures.totalGw}</span>
          <span data-unit="GW" className="ml-2 align-baseline text-copy-14 text-gray-900">
            GW
          </span>
        </p>
        <p className="mt-2 break-words text-copy-14 text-gray-900">
          {figures.missingCapacity.toLocaleString("en-GB")} projects have no published capacity and are not in this sum.
          A missing figure is {PIPELINE_NOT_PUBLISHED}.
        </p>
        <p className="mt-3 break-words text-copy-14 text-gray-900">{PIPELINE_EXCLUDED}</p>
        <p className="mt-4 flex min-w-0 flex-wrap items-center gap-1 text-copy-14 text-gray-1000">
          <span className="text-gray-900">Storage</span>
          <span className="tabular-nums">{shownGw(figures.storageTotal.gw)}</span>
          <InfoTooltip text={<StorageTooltip total={figures.storageTotal} />} label="What is the storage total?" />
        </p>
        <StorageSplit parts={figures.storage} />
        {loading ? (
          <div className="mt-5 flex flex-col gap-3">
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-4/5" />
          </div>
        ) : (
          <PipelineChartBoundary fail={chartFailed}>
            <StageBar figures={figures} />
          </PipelineChartBoundary>
        )}
      </Card>

      <Card>
        <PipelineExplainer />
      </Card>

      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <Card title="By technology" className="lg:col-span-2">
          {loading ? (
            <CardLoading />
          ) : (
            <PipelineChartBoundary fail={chartFailed}>
              <TechnologyList rows={figures.technologies} />
            </PipelineChartBoundary>
          )}
        </Card>
        <Card title="By nation" className="lg:col-span-1">
          {loading ? (
            <CardLoading />
          ) : (
            <PipelineChartBoundary fail={chartFailed}>
              <ul className="flex min-w-0 flex-col gap-3" aria-label="Capacity by nation">
                {figures.nations.map((row) => (
                  <BarRow
                    key={row.id}
                    label={row.label}
                    figure={shownGw(row.gw)}
                    projects={row.projects}
                    width={maxNation > 0 ? (row.exactGw / maxNation) * 100 : 0}
                    color={NATION_COLOR}
                  />
                ))}
              </ul>
            </PipelineChartBoundary>
          )}
        </Card>
      </div>

      <Card title="What happened to applications from 2015 to 2020">
        <p className="break-words text-copy-14 text-gray-900">
          {figures.cohort.applications.toLocaleString("en-GB")} GB applications with a submitted date in those years.
        </p>
        <ol className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap" aria-label="Cohort funnel">
          <FunnelStep label="Applications" value={figures.cohort.applications} />
          <FunnelStep label="Consented" value={figures.cohort.consented} />
          <FunnelStep label="Built" value={figures.cohort.built} />
          <FunnelStep label="Operating" value={figures.cohort.operating} />
        </ol>
        {loading ? (
          <CardLoading />
        ) : (
          <PipelineChartBoundary fail={chartFailed}>
            <ul className="mt-4 flex min-w-0 flex-col gap-2" aria-label="Cohort outcomes">
              {figures.cohort.outcomes.map((outcome) => (
                <li key={outcome.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <span className="min-w-0">
                    <span className="block break-words text-copy-14 text-gray-1000">{outcome.label}</span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-gray-200" aria-hidden="true">
                      <span className="block h-full rounded-full bg-gray-1000" style={{ width: `${outcome.percent}%` }} />
                    </span>
                  </span>
                  <span className="text-mono-12 text-gray-1000 tabular-nums">
                    {outcome.percent}%
                    <span className="text-gray-900"> {outcome.projects.toLocaleString("en-GB")}</span>
                  </span>
                </li>
              ))}
            </ul>
          </PipelineChartBoundary>
        )}
      </Card>

      <Card title="Median time in each stage">
        <ul className="flex min-w-0 flex-col gap-3">
          {figures.medians.map((step) => (
            <li key={step.id} className="flex min-w-0 flex-col gap-1 border-b border-gray-alpha-400 pb-3 last:border-b-0 last:pb-0">
              <span className="break-words text-copy-14 text-gray-1000">{step.label}</span>
              <MedianTrack step={step} maxDays={medianScale(figures.medians)} />
              <span className="break-words text-copy-14 text-gray-900 tabular-nums">
                {formatMedianDuration(step.days)}
                <span>
                  {" "}
                  · {step.projects.toLocaleString("en-GB")} {step.projects === 1 ? "project" : "projects"}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 break-words text-copy-14 text-gray-900">{PIPELINE_MEDIAN_NOTE}</p>
      </Card>

      {loading ? (
        <Card title="Projects">
          <CardLoading />
        </Card>
      ) : (
        <PipelineTable rows={figures.table} forcedEmpty={preview === "empty"} />
      )}

      <Card title="Northern Ireland">
        <p className="break-words text-copy-14 text-gray-1000">
          {figures.northernIreland.projects.toLocaleString("en-GB")} projects, {figures.northernIreland.gw} GW. These
          are outside the GB total.
        </p>
        <Link
          href={NI_PIPELINE_HREF}
          className="mt-3 inline-flex min-h-11 items-center text-copy-14 text-blue-700 underline-offset-2 hover:underline"
        >
          Northern Ireland electricity
        </Link>
      </Card>

      <Card title="Methodology" footer={<p>{PIPELINE_CREDIT}. {OGL_V3_ATTRIBUTION}</p>}>
        <div className="flex min-w-0 flex-col gap-3">
          {PIPELINE_METHODOLOGY.map((paragraph) => (
            <p key={paragraph.slice(0, 24)} className="break-words text-copy-14 text-gray-900">
              {paragraph}
            </p>
          ))}
        </div>
        <p className="mt-3 break-words text-copy-14 text-gray-900">
          <a href={OGL_V3_LICENCE_URL} className="text-blue-700 underline-offset-2 hover:underline">
            Open Government Licence v3.0
          </a>
        </p>
      </Card>
    </div>
  );
}

export function StorageTooltip({ total }: { total: StorageTotal }) {
  return (
    <span className="flex min-w-0 flex-col gap-2">
      <span className="text-label-13 text-gray-900">{PIPELINE_STORAGE_HEADING}</span>
      <span className="flex items-baseline justify-between gap-3">
        <span>{PIPELINE_STORAGE_TOTAL}</span>
        <span className="tabular-nums">{total.exactMwLabel}</span>
      </span>
      {total.rows.map((row) => (
        <span key={row.text} className="block break-words">
          {row.text}
        </span>
      ))}
    </span>
  );
}

function shownGw(gw: string): ReactNode {
  if (gw === "0.0") {
    return <Absent reason="Under 0.1 GW" />;
  }
  return `${gw} GW`;
}

function StageBar({ figures }: { figures: PipelineFigures }) {
  const percents = displayedPercents(
    figures.stages.map((stage) => (figures.exactGw > 0 ? (stage.exactGw / figures.exactGw) * 100 : 0)),
  );
  const label = figures.stages
    .map((stage, index) => {
      const amount = stage.gw === "0.0" ? "under 0.1 GW" : `${stage.gw} GW`;
      return `${amount} ${stageLabel(stage.id)} (${percents[index] ?? 0}%)`;
    })
    .join(", ");
  return (
    <div className="mt-5 min-w-0">
      <div className="mb-1 flex min-w-0" aria-hidden="true">
        {figures.stages.map((stage, index) => (
          <span
            key={stage.id}
            className="min-w-0 truncate text-label-13 text-gray-900"
            style={{ flexGrow: Math.max(stage.exactGw, 0.001), flexBasis: 0 }}
          >
            {percents[index] ?? 0}%
          </span>
        ))}
      </div>
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-gray-200"
        role="img"
        aria-label={`Pipeline by stage: ${label}`}
      >
        {figures.stages.map((stage) => (
          <span
            key={stage.id}
            className="h-full min-w-0"
            style={{
              flexGrow: stage.exactGw,
              flexBasis: 0,
              backgroundColor: STAGE_COLORS[stage.id],
            }}
          />
        ))}
      </div>
      <ul className="mt-3 flex min-w-0 flex-col gap-2">
        {figures.stages.map((stage, index) => (
          <li key={stage.id} className="flex min-w-0 items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-copy-14 text-gray-1000">
              <span
                aria-hidden="true"
                className="inline-block size-2 shrink-0 rounded-full"
                style={{ backgroundColor: STAGE_COLORS[stage.id] }}
              />
              <span className="min-w-0 break-words">
                {stage.label} {percents[index] ?? 0}%
              </span>
            </span>
            <span className="shrink-0 text-mono-12 text-gray-1000 tabular-nums">
              {shownGw(stage.gw)}
              <span className="text-gray-900"> {stage.projects.toLocaleString("en-GB")}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TechnologyList({ rows }: { rows: PipelineFigures["technologies"] }) {
  const grouped = groupTechnologies(rows);
  const max = Math.max(0, ...grouped.map((row) => row.exactGw));
  return (
    <ul className="flex min-w-0 flex-col gap-3" aria-label="Capacity by technology">
      {grouped.map((row) => (
        <BarRow
          key={row.id}
          label={row.label}
          figure={
            <>
              {row.amount}
              <span className="text-gray-900"> · {row.share}%</span>
            </>
          }
          projects={row.projects}
          width={max > 0 ? (row.exactGw / max) * 100 : 0}
          color={row.color}
          marker={row.marker}
        />
      ))}
    </ul>
  );
}

function groupTechnologies(rows: PipelineFigures["technologies"]): {
  id: string;
  label: string;
  amount: ReactNode;
  projects: number;
  exactGw: number;
  color: string;
  share: number;
  marker?: ReactNode;
}[] {
  const named = rows.slice(0, 8);
  const rest = rows.slice(8);
  const grouped = named.map((row) => ({
    id: row.id,
    label: row.label,
    amount: row.exactGw >= 0.1 ? (`${row.gw} GW` as ReactNode) : <Absent reason="Under 0.1 GW" />,
    projects: row.projects,
    exactGw: row.exactGw,
    color: row.color,
    marker: <MarkerSwatch shape={row.shape} color={row.color} />,
  }));
  if (rest.length > 0) {
    const exactGw = rest.reduce((sum, row) => sum + row.exactGw, 0);
    grouped.push({
      id: "other",
      label: "Other",
      amount: exactGw >= 0.1 ? `${exactGw.toFixed(1)} GW` : <Absent reason="Under 0.1 GW" />,
      projects: rest.reduce((sum, row) => sum + row.projects, 0),
      exactGw,
      color: "var(--chart-other)",
      marker: undefined,
    });
  }
  const total = grouped.reduce((sum, row) => sum + row.exactGw, 0);
  const shares = displayedPercents(grouped.map((row) => (total > 0 ? (row.exactGw / total) * 100 : 0)));
  return grouped.map((row, index) => ({ ...row, share: shares[index] ?? 0 }));
}

function medianScale(steps: PipelineFigures["medians"]): number {
  return Math.max(1, ...steps.map((step) => step.q3 ?? step.days ?? 0));
}

function MedianTrack({ step, maxDays }: { step: PipelineFigures["medians"][number]; maxDays: number }) {
  const left = step.q1 == null ? null : (step.q1 / maxDays) * 100;
  const right = step.q3 == null ? null : (step.q3 / maxDays) * 100;
  const dot = step.days == null ? null : (step.days / maxDays) * 100;
  return (
    <div className="relative h-3" aria-hidden="true">
      <div className="absolute inset-x-0 top-1 h-1 rounded-full bg-gray-200" />
      {left != null && right != null ? (
        <div
          className="absolute top-1 h-1 rounded-full bg-gray-1000"
          style={{ left: `${left}%`, width: `${Math.max(right - left, 0)}%` }}
        />
      ) : null}
      {dot != null ? (
        <div className="absolute top-0 size-3 rounded-full bg-gray-1000" style={{ left: `calc(${dot}% - 6px)` }} />
      ) : null}
    </div>
  );
}

function storageShares(parts: PipelineFigures["storage"]): number[] {
  const total = parts.reduce((sum, part) => sum + Math.max(part.exactGw, 0), 0);
  return displayedPercents(parts.map((part) => (total > 0 ? (Math.max(part.exactGw, 0) / total) * 100 : 0)));
}

function StorageSplit({ parts }: { parts: PipelineFigures["storage"] }) {
  const shares = storageShares(parts);
  return (
    <div className="mt-2" aria-label="Storage split">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-gray-200" role="img" aria-label="Storage by type">
        {parts.map((part) => (
          <span
            key={part.id}
            className="h-full min-w-0"
            style={{
              flexGrow: Math.max(part.exactGw, 0),
              flexBasis: 0,
              backgroundColor: storageColor(part.id),
            }}
          />
        ))}
      </div>
      <ul className="mt-3 flex min-w-0 flex-col gap-2">
        {parts.map((part) => (
          <li key={part.id} className="flex min-w-0 items-baseline justify-between gap-3 text-copy-14">
            <span className="flex min-w-0 items-center gap-2 text-gray-1000">
              <span aria-hidden="true" className="inline-block size-2 shrink-0 rounded-full" style={{ backgroundColor: storageColor(part.id) }} />
              <span className="min-w-0 break-words">{part.label}</span>
            </span>
            <span className="shrink-0 text-mono-12 tabular-nums text-gray-1000">
              {shownGw(part.gw)}
              <span className="text-gray-900"> {shares[parts.indexOf(part)] ?? 0}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function storageColor(id: string): string {
  switch (id) {
    case "battery":
      return "var(--chart-battery)";
    case "other_storage":
      return "var(--chart-hydro)";
    case "generation":
      return "var(--chart-wind)";
    default:
      return "var(--chart-other)";
  }
}

function BarRow({
  label,
  figure,
  projects,
  width,
  color,
  marker,
}: {
  label: string;
  figure: ReactNode;
  projects: number;
  width: number;
  color: string;
  marker?: ReactNode;
}) {
  return (
    <li className="grid min-w-0 grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-2">
      {marker ?? <span aria-hidden="true" className="size-3.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
      <span className="min-w-0">
        <span className="block break-words text-copy-14 text-gray-1000">{label}</span>
        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-gray-200" aria-hidden="true">
          <span className="block h-full rounded-full" style={{ width: `${width}%`, backgroundColor: color }} />
        </span>
      </span>
      <span className="shrink-0 text-mono-12 text-gray-1000 tabular-nums">
        {figure}
        <span className="text-gray-900"> {projects.toLocaleString("en-GB")}</span>
      </span>
    </li>
  );
}

function FunnelStep({ label, value }: { label: string; value: number }) {
  return (
    <li className="min-w-0">
      <p className="text-label-13 text-gray-900">{label}</p>
      <p className="text-heading-24 tabular-nums text-gray-1000">{value.toLocaleString("en-GB")}</p>
    </li>
  );
}
