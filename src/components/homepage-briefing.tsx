import Link from "next/link";
import { SITE_NAV_LINKS } from "@/components/site-public-nav";
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
      <nav aria-label="Site" className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-label-13">
        {SITE_NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-blue-700 underline-offset-2 hover:underline"
          >
            {link.label}
          </Link>
        ))}
      </nav>
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
        </>
      ) : (
        <p className="mt-3 max-w-3xl text-copy-16 text-gray-900" data-cite>
          {HOME_CITE_FALLBACK}
        </p>
      )}
    </div>
  );
}
