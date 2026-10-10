import {
  HOME_CITE_FALLBACK,
  HOME_CITE_SOURCES,
  HOME_H1,
  type HomepageCite,
} from "@/lib/homepage-briefing";

export function HomepageBriefing({ cite }: { cite: HomepageCite }) {
  return (
    <div>
      <h1 className="text-heading-32 text-gray-1000">{HOME_H1}</h1>
      {cite.kind === "numbers" ? (
        <>
          <p className="mt-3 max-w-3xl text-copy-16 text-gray-900" data-cite>
            At{" "}
            <time dateTime={cite.datetime}>
              {cite.timeLabel}
            </time>{" "}
            on {cite.dateLabel}, {cite.topFuel} was Britain&apos;s largest source of electricity at{" "}
            {cite.topGw} GW ({cite.topSharePct}%). Gas supplied {cite.gasSharePct}%, and carbon
            intensity was {cite.carbon} gCO₂/kWh. The market index price was £{cite.price}/MWh.{" "}
            {HOME_CITE_SOURCES} Grid is free and updated hourly from public data.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeadlineStat label="Demand" value={`${cite.demandGw} GW`} />
            <HeadlineStat label="Generation" value={`${cite.generationGw} GW`} />
            <HeadlineStat label={cite.topFuel} value={`${cite.topGw} GW`} />
            <HeadlineStat label="Carbon" value={`${cite.carbon} gCO₂/kWh`} />
          </dl>
        </>
      ) : (
        <p className="mt-3 max-w-3xl text-copy-16 text-gray-900" data-cite>
          {HOME_CITE_FALLBACK}
        </p>
      )}
    </div>
  );
}

function HeadlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-label-13 text-gray-900">{label}</dt>
      <dd className="mt-1 font-sans text-heading-24 tabular-nums text-gray-1000">{value}</dd>
    </div>
  );
}
