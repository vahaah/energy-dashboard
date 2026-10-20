import type { ReactNode } from "react";
import Link from "next/link";
import { MarkerSwatch } from "@/components/marker-swatch";
import { PipelineExplainer } from "@/components/pipeline/pipeline-explainer";
import { PipelineTable } from "@/components/pipeline/pipeline-table";
import { Card } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { OGL_V3_ATTRIBUTION, OGL_V3_LICENCE_URL } from "@/lib/attribution";
import { STAGE_COLORS } from "@/lib/pipeline/colors";
import {
  NI_PIPELINE_HREF,
  PIPELINE_CREDIT,
  PIPELINE_EXCLUDED,
  PIPELINE_MEDIAN_NOTE,
  PIPELINE_METHODOLOGY,
  PIPELINE_NOT_PUBLISHED,
  PIPELINE_NOT_UPDATED,
} from "@/lib/pipeline/copy";
import { formatMedianDuration, stageLabel, type PipelineFigures } from "@/lib/pipeline/model";

const NATION_COLOR = "#0d94d2";

export function PipelineBoard({
  figures,
  stamp,
  stale,
}: {
  figures: PipelineFigures;
  stamp: string;
  stale: boolean;
}) {
  const count = figures.projects.toLocaleString("en-GB");
  const maxTechnology = Math.max(0, ...figures.technologies.map((row) => row.exactGw));
  const maxNation = Math.max(0, ...figures.nations.map((row) => row.exactGw));
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card title="In the pipeline">
        <p className="break-words text-copy-14 text-gray-900" data-edition>
          {stamp}
          {stale ? (
            <span className="mt-2 block border-t-2 border-amber-700 pt-2 text-gray-1000">{PIPELINE_NOT_UPDATED}</span>
          ) : null}
        </p>
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
          <span className="tabular-nums">{figures.storageTotal.gw} GW</span>
          <InfoTooltip text={figures.storageTotal.exactMwLabel} label="What is the storage total?" />
        </p>
        <ul className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap" aria-label="Storage split">
          {figures.storage.map((part) => (
            <li key={part.id} className="min-w-0 text-copy-14 text-gray-1000">
              <span className="text-gray-900">{part.label}</span>{" "}
              <span className="tabular-nums">{shownGw(part.gw)}</span>
            </li>
          ))}
        </ul>
        <StageBar figures={figures} />
      </Card>

      <Card>
        <PipelineExplainer />
      </Card>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card title="By technology">
          <ul className="flex min-w-0 flex-col gap-3" aria-label="Capacity by technology">
            {figures.technologies.map((row) => (
              <BarRow
                key={row.id}
                label={row.label}
                gw={row.gw}
                projects={row.projects}
                width={maxTechnology > 0 ? (row.exactGw / maxTechnology) * 100 : 0}
                color={row.color}
                marker={<MarkerSwatch shape={row.shape} color={row.color} />}
              />
            ))}
          </ul>
        </Card>
        <Card title="By nation">
          <ul className="flex min-w-0 flex-col gap-3" aria-label="Capacity by nation">
            {figures.nations.map((row) => (
              <BarRow
                key={row.id}
                label={row.label}
                gw={row.gw}
                projects={row.projects}
                width={maxNation > 0 ? (row.exactGw / maxNation) * 100 : 0}
                color={NATION_COLOR}
              />
            ))}
          </ul>
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
      </Card>

      <Card title="Median time in each stage">
        <ul className="flex min-w-0 flex-col gap-3">
          {figures.medians.map((step) => (
            <li key={step.id} className="flex min-w-0 flex-col gap-1 border-b border-gray-alpha-400 pb-3 last:border-b-0 last:pb-0">
              <span className="break-words text-copy-14 text-gray-1000">{step.label}</span>
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

      <PipelineTable rows={figures.table} />

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

function shownGw(gw: string): string {
  return gw === "0.0" ? "—" : `${gw} GW`;
}

function StageBar({ figures }: { figures: PipelineFigures }) {
  const label = figures.stages.map((stage) => `${stage.gw} GW ${stageLabel(stage.id)}`).join(", ");
  return (
    <div className="mt-5 min-w-0">
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
        {figures.stages.map((stage) => (
          <li key={stage.id} className="flex min-w-0 items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-copy-14 text-gray-1000">
              <span
                aria-hidden="true"
                className="inline-block size-2 shrink-0 rounded-full"
                style={{ backgroundColor: STAGE_COLORS[stage.id] }}
              />
              <span className="min-w-0 break-words">{stage.label}</span>
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

function BarRow({
  label,
  gw,
  projects,
  width,
  color,
  marker,
}: {
  label: string;
  gw: string;
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
      <span className="text-mono-12 text-gray-1000 tabular-nums">
        {shownGw(gw)}
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
