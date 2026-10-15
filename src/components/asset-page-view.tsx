import Link from "next/link";
import { CopyLinkButton } from "@/components/copy-link-button";
import { Card } from "@/components/ui/card";
import { flowDirection, latestFlow } from "@/lib/assets/flows";
import { LOCATION_UNAVAILABLE, NOT_AVAILABLE, missingSeriesCopy, precisionLabel } from "@/lib/assets/labels";
import type { AssetFact, AssetPageModel } from "@/lib/assets/page-model";
import { SCHEMATIC_BBOX, SCHEMATIC_LINK_LABEL } from "@/lib/catalogue/links/schema";
import { formatLondonDateTimeStamp, parseUtcDateTime } from "@/lib/london-time";
import { SITE_URL } from "@/lib/site";
import type { InterconnectorFlow } from "@/lib/types";

const CHIP = "inline-flex max-w-full items-center rounded-md border border-gray-alpha-400 px-1.5 py-0.5 text-label-12 text-gray-900";
const ACTION = "inline-flex h-8 min-h-11 items-center justify-center rounded-md border border-gray-alpha-400 bg-background-100 px-3 text-label-13 text-gray-1000 sm:min-h-8";

const POINT_BOX = { west: -8.2, south: 49.8, east: 1.8, north: 60.9 };

function project(
  longitude: number,
  latitude: number,
  box: { west: number; south: number; east: number; north: number },
): { x: number; y: number } {
  const width = box.east - box.west || 1;
  const height = box.north - box.south || 1;
  return {
    x: ((longitude - box.west) / width) * 280,
    y: ((box.north - latitude) / height) * 160,
  };
}

export function AssetFacts({ facts }: { facts: readonly AssetFact[] }) {
  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      {facts.map((fact) => (
        <div
          key={fact.id}
          data-fact={fact.id}
          data-fact-column={fact.column}
          className={`min-w-0 ${fact.column === 1 ? "sm:col-start-1" : "sm:col-start-2"}`}
        >
          <Card as="article" size="stat" title={fact.label} tooltip={fact.tooltip}>
            <p className="break-words text-heading-24 text-gray-1000">{fact.value}</p>
          </Card>
        </div>
      ))}
    </div>
  );
}

function MiniMap({ model }: { model: AssetPageModel }) {
  const map = model.miniMap;
  return (
    <Card
      title="Location"
      footer={model.attributions.length > 0 ? <div className="flex flex-col gap-2 break-words">{model.attributions.map((line) => <p key={line}>{line}</p>)}</div> : undefined}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {model.precision ? <span className={CHIP}>{precisionLabel(model.precision)}</span> : null}
      </div>
      {map.kind === "none" ? (
        <p className="mt-3 text-copy-16 text-gray-1000">{LOCATION_UNAVAILABLE}</p>
      ) : (
        <div className="mt-3 min-w-0">
          {map.kind === "line" ? (
            <SchematicLine map={map} />
          ) : (
            <PointSketch longitude={map.longitude} latitude={map.latitude} />
          )}
          <p className="mt-3 break-words text-copy-14 text-gray-900">{model.coordinatesLabel}</p>
        </div>
      )}
      <p className="mt-4">
        <Link href={model.mapHref} className="text-blue-700 underline-offset-2 hover:underline">
          Open in Map
        </Link>
      </p>
    </Card>
  );
}

function PointSketch({ longitude, latitude }: { longitude: number; latitude: number }) {
  const spot = project(longitude, latitude, POINT_BOX);
  return (
    <svg viewBox="0 0 280 160" className="h-40 w-full rounded-lg bg-background-200" role="img" aria-label="Approximate location">
      <circle cx={spot.x} cy={spot.y} r="5" fill="var(--chart-wind)" />
    </svg>
  );
}

function SchematicLine({
  map,
}: {
  map: Extract<AssetPageModel["miniMap"], { kind: "line" }>;
}) {
  const start = project(map.gbLongitude, map.gbLatitude, SCHEMATIC_BBOX);
  const end = project(map.remoteLongitude, map.remoteLatitude, SCHEMATIC_BBOX);
  return (
    <div className="min-w-0">
      <svg viewBox="0 0 280 160" className="h-40 w-full rounded-lg bg-background-200" role="img" aria-label={SCHEMATIC_LINK_LABEL}>
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke="var(--chart-imports)"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
      </svg>
      <p className="mt-2 text-copy-14 text-gray-900">{SCHEMATIC_LINK_LABEL}</p>
    </div>
  );
}

function OutputSeries({ model, series }: { model: AssetPageModel; series: readonly InterconnectorFlow[] | null }) {
  if (!model.output.attached) {
    return (
      <Card title="Output">
        <p className="text-copy-16 text-gray-1000">{missingSeriesCopy(model.output.source)}</p>
      </Card>
    );
  }
  const latest = series ? latestFlow(series) : null;
  const direction = latest ? flowDirection(latest.generation_mw) : null;
  const values = (series ?? []).map((row) => row.generation_mw);
  return (
    <Card title="Output" footer={<p className="break-words">{model.attributions.join(" ")}</p>}>
      <p className="text-label-13 text-gray-900">FUELINST {model.output.code}</p>
      <p className="mt-2 break-words text-heading-24 text-gray-1000">
        {latest ? `${latest.generation_mw} MW` : NOT_AVAILABLE}
      </p>
      {direction ? (
        <p className="mt-1 text-copy-14 text-gray-900">
          {direction === "import" ? "Import to Great Britain" : "Export from Great Britain"}
        </p>
      ) : null}
      {latest ? (
        <p className="mt-1 text-mono-12 text-gray-900">{formatLondonDateTimeStamp(parseUtcDateTime(latest.timestamp))}</p>
      ) : null}
      <p className="mt-3 text-copy-14 text-gray-900">{model.output.note}</p>
      {values.length > 1 ? <Sparkline values={values} /> : null}
    </Card>
  );
}

function Sparkline({ values }: { values: readonly number[] }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 280;
  const height = 64;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-16 w-full" role="img" aria-label="Metered flow">
      <polyline fill="none" stroke="var(--chart-imports)" strokeWidth="2" points={points} />
    </svg>
  );
}

export function AssetPageView({
  model,
  series,
}: {
  model: AssetPageModel;
  series: readonly InterconnectorFlow[] | null;
}) {
  return (
    <>
      <header className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="min-w-0 break-words text-heading-32 text-gray-1000">{model.name}</h1>
          <span className={CHIP}>{model.technologyLabel}</span>
          <span className={CHIP}>{model.statusLabel}</span>
        </div>
        <p className="mt-2 text-mono-12 text-gray-900">Grid ID {model.id}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link href={model.mapHref} className={ACTION}>
            View on map
          </Link>
          <CopyLinkButton url={`${SITE_URL}${model.canonicalPath}`} />
        </div>
        <p className="mt-4 break-words text-copy-16 text-gray-1000">{model.question}</p>
        <p className="mt-2 max-w-3xl break-words text-copy-16 text-gray-900">{model.lede}</p>
      </header>
      <AssetFacts facts={model.facts} />
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <MiniMap model={model} />
        <Card title="Identity and relationships">
          {model.identities.length === 0 ? (
            <p className="text-copy-14 text-gray-900">No identity links are recorded.</p>
          ) : (
            <ul className="flex min-w-0 flex-col gap-4">
              {model.identities.map((identity) => (
                <li key={`${identity.label}-${identity.value}`} className="min-w-0 border-t border-gray-alpha-400 pt-4 first:border-t-0 first:pt-0">
                  <p className="text-label-13 text-gray-900">{identity.label}</p>
                  <p className="mt-1 break-words text-copy-16 text-gray-1000">{identity.value}</p>
                  <p className="mt-1 break-words text-copy-14 text-gray-900">{identity.evidence}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <OutputSeries model={model} series={series} />
      <Card title="Ownership and operator">
        <ul className="grid min-w-0 gap-4 sm:grid-cols-2">
          {model.claims.map((claim) => (
            <li key={`${claim.role}-${claim.source}-${claim.value}`} className="min-w-0">
              <p className="text-label-13 text-gray-900">
                {claim.role} · {claim.source}
              </p>
              <p className="mt-1 break-words text-copy-16 text-gray-1000">{claim.value}</p>
              <p className="mt-1 break-words text-copy-14 text-gray-900">{claim.evidence}</p>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Related projects">
        {model.projects.length === 0 ? (
          <p className="text-copy-14 text-gray-900">No related projects are recorded.</p>
        ) : (
          <ul className="flex min-w-0 flex-col gap-4">
            {model.projects.map((project) => (
              <li key={`${project.name}-${project.detail}`} className="min-w-0 border-t border-gray-alpha-400 pt-4 first:border-t-0 first:pt-0">
                <p className="break-words text-copy-16 text-gray-1000">{project.name}</p>
                <p className="mt-1 break-words text-copy-14 text-gray-900">{project.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Change history">
        {model.history.length === 0 ? (
          <p className="text-copy-14 text-gray-900">No change history is recorded.</p>
        ) : (
          <ul className="flex min-w-0 flex-col gap-4">
            {model.history.map((row) => (
              <li key={row.id} className="min-w-0 border-t border-gray-alpha-400 pt-4 first:border-t-0 first:pt-0">
                <p className="break-words text-copy-16 text-gray-1000">{row.edition}</p>
                <p className="mt-1 break-words text-copy-14 text-gray-900">
                  {row.published} · {row.source} · {row.mw} · {row.counts}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Source records">
        <ul className="flex min-w-0 flex-col gap-4">
          {model.sourceRecords.map((record) => (
            <li key={record.id} className="min-w-0 border-t border-gray-alpha-400 pt-4 first:border-t-0 first:pt-0">
              <p className="break-words text-copy-16 text-gray-1000">{record.source}</p>
              <p className="mt-1 break-words text-copy-14 text-gray-900">{record.edition}</p>
              <p className="mt-2">
                {record.href ? (
                  <a href={record.href} className="text-blue-700 underline-offset-2 hover:underline">
                    Source record
                  </a>
                ) : (
                  <span className="text-copy-14 text-gray-900">Source record</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
