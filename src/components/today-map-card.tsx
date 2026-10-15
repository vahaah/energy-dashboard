import { Card } from "@/components/ui/card";
import { NESO_OPEN_DATA_ATTRIBUTION, OGL_V3_ATTRIBUTION, OGL_V3_LICENCE_URL } from "@/lib/attribution";
import { TODAY_MAP_LINK, TODAY_MAP_SUMMARY, TODAY_MAP_TITLE, todayMapEditionLine } from "@/lib/map/today-card";
import card from "@/lib/map/today-card.json";

const LINK_CLASS =
  "mt-4 flex w-full max-w-64 flex-col gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 focus-visible:ring-offset-background-100";

/**
 * Static register thumbnail. A plain anchor so the homepage does not prefetch
 * the map route, its client, or any tiles.
 */
export function TodayMapCard() {
  return (
    <Card
      id="section-published-map"
      title={TODAY_MAP_TITLE}
      footer={
        <p className="break-words">
          {NESO_OPEN_DATA_ATTRIBUTION}.{" "}
          <a
            href={OGL_V3_LICENCE_URL}
            className="underline decoration-gray-alpha-400 underline-offset-2 hover:text-gray-1000"
          >
            {OGL_V3_ATTRIBUTION}
          </a>
        </p>
      }
    >
      <p className="max-w-prose text-copy-14 text-gray-900">{TODAY_MAP_SUMMARY}</p>
      <a href="/map" className={LINK_CLASS}>
        <span className="relative block w-full" style={{ aspectRatio: `${card.width} / ${card.height}` }}>
          {/* Fixed catalogue PNG. next/image would run the optimizer on a request. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={card.light}
            alt={card.alt}
            width={card.width}
            height={card.height}
            className="today-map-light absolute inset-0 size-full"
            decoding="async"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={card.dark}
            alt={card.alt}
            width={card.width}
            height={card.height}
            className="today-map-dark absolute inset-0 size-full"
            decoding="async"
          />
        </span>
        <span className="text-copy-14 text-blue-700 underline-offset-2 hover:underline">{TODAY_MAP_LINK}</span>
      </a>
      <p className="mt-2 text-label-12 text-gray-900">{todayMapEditionLine(card.edition)}</p>
    </Card>
  );
}
