import type { ReactNode } from "react";
import {
  HOME_CITE_FALLBACK,
  HOME_CITE_SOURCES,
  HOME_H1,
  type HomepageCite,
} from "@/lib/homepage-briefing";

export function HomepageBriefing({
  cite,
  title = HOME_H1,
  showCite = true,
  controls = null,
}: {
  cite: HomepageCite;
  title?: string;
  showCite?: boolean;
  controls?: ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="min-w-0 text-heading-32 text-gray-1000">{title}</h1>
        {controls ? <div className="shrink-0">{controls}</div> : null}
      </div>
      {showCite ? <HomepageCiteParagraph cite={cite} /> : null}
    </div>
  );
}

function HomepageCiteParagraph({ cite }: { cite: HomepageCite }) {
  switch (cite.kind) {
    case "numbers":
      return (
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
      );
    case "fallback":
      return (
        <p className="mt-3 max-w-3xl text-copy-16 text-gray-900" data-cite>
          {HOME_CITE_FALLBACK}
        </p>
      );
    default: {
      const exhaustive: never = cite;
      return exhaustive;
    }
  }
}
