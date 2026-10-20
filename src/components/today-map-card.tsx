import { Card, CardEmpty } from "@/components/ui/card";
import { OGL_V3_ATTRIBUTION, OGL_V3_LICENCE_URL } from "@/lib/attribution";
import { MAP_SIZE_STEPS, type MarkerShape } from "@/lib/map/marker";
import {
  TODAY_MAP_CONSENT,
  TODAY_MAP_LIST,
  TODAY_MAP_OPEN,
  TODAY_MAP_PIPELINE_UNFILTERED,
  TODAY_MAP_SCOPE,
  TODAY_MAP_SUMMARY,
  TODAY_MAP_TITLE,
  formatTodayCount,
  registerFreshness,
  type TodayMapCardFile,
  type TodayMapCount,
} from "@/lib/map/today-card";
import cardFile from "@/lib/map/today-card.json";
import { todayGroup } from "@/lib/map/today-figures";

const card = cardFile as TodayMapCardFile;

const ACTION_CLASS =
  "flex h-11 items-center rounded-md text-copy-14 text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 focus-visible:ring-offset-background-100";

/**
 * Static register card. Figures are the committed JSON. A plain anchor so the
 * homepage does not prefetch the map route, its client, or any tiles.
 */
export function TodayMapCard({ now = new Date() }: { now?: Date }) {
  return <TodayMapCardView file={card} now={now} />;
}

export function TodayMapCardView({ file, now }: { file: TodayMapCardFile; now: Date }) {
  const freshness = registerFreshness(
    { repdQuarterEnd: file.repd_quarter_end, dukesPublishedOn: file.dukes_published_on },
    now,
  );
  const missingFigure =
    file.technologies.some((row) => row.gw === null) ||
    file.nations.some((row) => row.gw === null) ||
    file.pipeline.stages.some((row) => row.gw === null);
  const amber = freshness.stale || !file.pipeline.filtered || file.availability !== "ready" || missingFigure;
  const showMap = file.availability === "ready";
  const maxGw = Math.max(0, ...file.technologies.map((row) => (row.gw === null ? 0 : Number(row.gw))));

  return (
    <Card
      id="section-published-map"
      title={TODAY_MAP_TITLE}
      footer={
        <div className="flex min-w-0 flex-col gap-2">
          <p className="break-words">
            <a
              href={OGL_V3_LICENCE_URL}
              className="underline decoration-gray-alpha-400 underline-offset-2 hover:text-gray-1000"
            >
              {OGL_V3_ATTRIBUTION}
            </a>
          </p>
          <p className={amber ? "break-words border-t-2 border-amber-700 pt-2" : "break-words"}>{file.edition}</p>
        </div>
      }
    >
      <p className="max-w-prose text-copy-14 text-gray-1000">{TODAY_MAP_SUMMARY}</p>
      <p className="mt-1 text-copy-14 text-gray-900">{TODAY_MAP_SCOPE}</p>
      <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-[220px_minmax(0,1fr)] md:items-start lg:grid-cols-[240px_minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[264px_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="order-3 min-w-0 md:order-none md:col-start-1 md:row-start-1">
          {showMap ? (
            <MapFrame file={file} />
          ) : (
            <CardEmpty>The map is not available for this edition.</CardEmpty>
          )}
          <SizeKey />
        </div>
        <div className="order-1 min-w-0 md:order-none md:col-start-2 md:row-start-1 lg:col-start-2">
          <FigureBlock
            kicker="Operating"
            gw={file.operating.gw}
            count={file.operating.sites}
            countNoun="sites"
          />
          <ul className="mt-4 flex flex-col gap-2" aria-label="Operating capacity">
            {file.technologies.map((row) => (
              <TechnologyRow key={row.id} row={row} maxGw={maxGw} />
            ))}
          </ul>
          <ul className="mt-4 flex flex-col gap-1.5 border-t border-gray-alpha-400 pt-3" aria-label="Nations">
            {file.nations.map((row) => (
              <li key={row.id} className="flex min-w-0 items-baseline justify-between gap-3">
                <span className="text-copy-14 text-gray-1000">{nationLabel(row.id)}</span>
                <span className="text-mono-12 text-gray-1000">{gwText(row.gw)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="order-2 min-w-0 md:order-none md:col-start-2 md:row-start-2 lg:col-start-3 lg:row-start-1">
          <FigureBlock kicker="Pipeline" gw={file.pipeline.gw} count={file.pipeline.sites} countNoun="projects" />
          <ul className="mt-4 flex flex-col gap-2" aria-label="Pipeline">
            {file.pipeline.stages.map((row) => (
              <li key={row.id} className="flex min-w-0 items-baseline justify-between gap-3">
                <span className="min-w-0 text-copy-14 text-gray-1000">{stageLabel(row.id)}</span>
                <span className="shrink-0 text-mono-12 text-gray-1000">
                  {gwText(row.gw)}
                  <span className="text-gray-900"> {countText(row.sites)}</span>
                </span>
              </li>
            ))}
          </ul>
          {file.pipeline.filtered ? null : (
            <p className="mt-3 text-copy-14 text-gray-900">{TODAY_MAP_PIPELINE_UNFILTERED}</p>
          )}
          <p className="mt-3 text-copy-14 text-gray-900">{TODAY_MAP_CONSENT}</p>
        </div>
        <div className="order-4 flex min-w-0 flex-col md:order-none md:col-start-1 md:row-start-2 lg:row-start-2">
          {/* Plain anchors. next/link would prefetch the map route and the asset list. */}
          <a href="/map" className={ACTION_CLASS}>
            {TODAY_MAP_OPEN}
          </a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/assets" className={ACTION_CLASS}>
            {TODAY_MAP_LIST}
          </a>
        </div>
      </div>
    </Card>
  );
}

function FigureBlock({
  kicker,
  gw,
  count,
  countNoun,
}: {
  kicker: string;
  gw: string | null;
  count: number | null;
  countNoun: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-label-13 text-gray-900">{kicker}</p>
      <p className="text-[30px] font-semibold leading-[36px] tracking-tight text-gray-1000 md:text-[36px] md:leading-[40px]">
        {gw === null ? "—" : `${gw} GW`}
      </p>
      <p className="text-mono-12 text-gray-900">{count === null ? "—" : `${formatTodayCount(count)} ${countNoun}`}</p>
    </div>
  );
}

function TechnologyRow({ row, maxGw }: { row: TodayMapCount; maxGw: number }) {
  const group = todayGroup(row.id);
  const label = group?.label ?? row.id;
  const width = row.gw === null || maxGw <= 0 ? 0 : (Number(row.gw) / maxGw) * 100;
  return (
    <li className="grid min-w-0 grid-cols-[14px_minmax(0,1.1fr)_minmax(2.5rem,1fr)_auto] items-center gap-2">
      {group ? <MarkerSwatch shape={group.shape} color={group.color} /> : <span aria-hidden="true" />}
      <span className="min-w-0 text-copy-14 text-gray-1000">{label}</span>
      <span className="h-1.5 min-w-0 overflow-hidden rounded-full bg-gray-200" aria-hidden="true">
        <span className="block h-full rounded-full" style={{ width: `${width}%`, backgroundColor: group?.color }} />
      </span>
      <span className="text-mono-12 text-gray-1000">
        {gwText(row.gw)}
        <span className="text-gray-900"> {countText(row.sites)}</span>
      </span>
    </li>
  );
}

function MapFrame({ file }: { file: TodayMapCardFile }) {
  return (
    <div
      className="relative w-full max-md:h-[295px]"
      style={{ aspectRatio: `${file.width} / ${file.height}` }}
    >
      {/* Fixed catalogue PNG. next/image would run the optimizer on a request. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={file.light}
        alt={file.alt}
        width={file.width}
        height={file.height}
        loading="lazy"
        decoding="async"
        className="today-map-light absolute inset-0 size-full object-contain"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={file.dark}
        alt={file.alt}
        width={file.width}
        height={file.height}
        loading="lazy"
        decoding="async"
        className="today-map-dark absolute inset-0 size-full object-contain"
      />
    </div>
  );
}

function SizeKey() {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1" aria-label="Capacity">
      {MAP_SIZE_STEPS.map((step) => (
        <li key={step.id} className="flex items-center gap-1.5 text-mono-12 text-gray-1000">
          <span
            className="inline-block shrink-0 rounded-full bg-gray-1000"
            style={{ width: Math.max(4, step.radius / 2), height: Math.max(4, step.radius / 2) }}
            aria-hidden="true"
          />
          {step.label}
        </li>
      ))}
    </ul>
  );
}

function MarkerSwatch({ shape, color }: { shape: MarkerShape; color: string }) {
  const common = { fill: color };
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="shrink-0">
      {swatchShape(shape, common)}
    </svg>
  );
}

function swatchShape(shape: MarkerShape, common: { fill: string }) {
  switch (shape) {
    case "circle":
      return <circle cx="7" cy="7" r="5" {...common} />;
    case "square":
      return <rect x="2.2" y="2.2" width="9.6" height="9.6" {...common} />;
    case "triangle":
      return <polygon points="7,1.5 12.2,12 1.8,12" {...common} />;
    case "diamond":
      return <polygon points="7,1.2 12.6,7 7,12.8 1.4,7" {...common} />;
    case "hexagon":
      return <polygon points="7,1.4 11.8,4.2 11.8,9.8 7,12.6 2.2,9.8 2.2,4.2" {...common} />;
    case "plus":
      return <polygon points="5,1.5 9,1.5 9,5 12.5,5 12.5,9 9,9 9,12.5 5,12.5 5,9 1.5,9 1.5,5 5,5" {...common} />;
    case "ring":
      return (
        <>
          <circle cx="7" cy="7" r="5" {...common} />
          <circle cx="7" cy="7" r="2.4" fill="var(--background-100)" />
        </>
      );
    case "triangle-down":
      return <polygon points="7,12.5 12.2,2 1.8,2" {...common} />;
    default: {
      const neverShape: never = shape;
      return neverShape;
    }
  }
}

function gwText(gw: string | null): string {
  return gw === null ? "—" : `${gw} GW`;
}

function countText(sites: number): string {
  return sites.toLocaleString("en-GB");
}

function nationLabel(id: string): string {
  switch (id) {
    case "England":
    case "Scotland":
    case "Wales":
      return id;
    default:
      return id;
  }
}

function stageLabel(id: string): string {
  switch (id) {
    case "under_construction":
      return "Under construction";
    case "consented":
      return "Consented";
    case "in_planning":
      return "In planning";
    default:
      return id;
  }
}
