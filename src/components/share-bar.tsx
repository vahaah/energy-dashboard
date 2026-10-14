import { CARD_PAD_BOTTOM, CARD_PAD_X } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { formatHeadlineGw } from "@/lib/facts";
import {
  formatSharePercent,
  shareBarSegmentStyle,
  showsInlineShareLabel,
  type GenerationMixShare,
} from "@/lib/generation-share";

export function ShareBar({
  shares,
  generationMw,
  carbon,
  carbonHelp,
}: {
  shares: GenerationMixShare[];
  generationMw: number | null;
  carbon: number | null;
  carbonHelp: string;
}) {
  const summary = shares
    .map((share) => `${share.label} ${formatSharePercent(share.sharePct)}%`)
    .join(", ");

  return (
    <div data-slot="card-pad" className={`${CARD_PAD_X} ${CARD_PAD_BOTTOM}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <p className="min-w-0 text-label-13 text-gray-900">
          Share of generation
          {generationMw != null ? (
            <span className="tabular-nums"> · of {formatHeadlineGw(generationMw)} GW generation</span>
          ) : null}
          <span className="ml-1 inline-flex align-middle">
            <InfoTooltip
              text="Each segment is that fuel’s share of GB generation in this half-hour. Imports and exports are in the equation, not in the bar. The segments add up to 100%."
              label="What is Share of generation?"
            />
          </span>
        </p>
        <p className="min-w-0 text-label-13 text-gray-900">
          Carbon intensity{" "}
          <span className="font-semibold tabular-nums text-gray-1000">
            {carbon == null ? "—" : `${carbon.toFixed(0)} gCO₂/kWh`}
          </span>
          <span className="ml-1 inline-flex align-middle">
            <InfoTooltip text={carbonHelp} label="What is Carbon intensity?" />
          </span>
        </p>
      </div>
      {shares.length === 0 ? (
        <div className="h-2.5 w-full rounded-sm bg-background-200 sm:h-3" aria-hidden="true" />
      ) : (
        <>
          <div className="mb-1.5 flex gap-0.5" aria-hidden="true">
            {shares.map((share) => (
              <div
                key={share.fuel}
                className="min-w-0"
                style={shareBarSegmentStyle(share.sharePct)}
              >
                <InlineLabel share={share} />
              </div>
            ))}
          </div>
          <div
            className="flex h-2.5 gap-0.5 overflow-hidden rounded-sm sm:h-3"
            role="img"
            aria-label={summary}
          >
            {shares.map((share) => (
              <span
                key={share.fuel}
                className="h-full min-w-0"
                style={{ ...shareBarSegmentStyle(share.sharePct), backgroundColor: share.color }}
              />
            ))}
          </div>
          <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-label-12 sm:flex sm:flex-wrap">
            {shares.map((share) => (
              <LegendItem key={share.fuel} share={share} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function InlineLabel({ share }: { share: GenerationMixShare }) {
  const desktop = showsInlineShareLabel(share.sharePct, false);
  const narrow = showsInlineShareLabel(share.sharePct, true);
  if (!desktop) {
    return null;
  }
  return (
    <p className={`truncate text-label-12 ${narrow ? "" : "hidden sm:block"}`}>
      <span className="font-semibold text-gray-1000">{share.label}</span>{" "}
      <span className="text-gray-900 tabular-nums">{formatSharePercent(share.sharePct)}%</span>
    </p>
  );
}

function LegendItem({ share }: { share: GenerationMixShare }) {
  const desktop = showsInlineShareLabel(share.sharePct, false);
  const narrow = showsInlineShareLabel(share.sharePct, true);
  if (narrow) {
    return null;
  }
  const mobileOnly = desktop && !narrow;
  return (
    <li
      tabIndex={0}
      className={`flex min-w-0 items-center gap-1.5 rounded-sm text-gray-1000 outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${mobileOnly ? "sm:hidden" : ""}`}
    >
      <span
        className="size-2 shrink-0 rounded-[2px]"
        style={{ backgroundColor: share.color }}
        aria-hidden="true"
      />
      <span className="truncate">{share.label}</span>
      <span className="tabular-nums text-gray-900">
        {formatHeadlineGw(share.mw)} GW · {formatSharePercent(share.sharePct)}%
      </span>
    </li>
  );
}
