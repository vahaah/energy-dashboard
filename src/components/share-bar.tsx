import { CARD_PAD_BOTTOM, CARD_PAD_X } from "@/components/ui/card";
import { formatHeadlineGw } from "@/lib/facts";
import {
  formatSharePercent,
  shareBarSegmentStyle,
  type GenerationMixShare,
} from "@/lib/generation-share";

export function ShareBar({
  shares,
  generationGw,
  carbon,
  carbonHelp,
}: {
  shares: GenerationMixShare[];
  generationGw: string | null;
  carbon: number | null;
  carbonHelp: string;
}) {
  const summary = shares
    .map((share) => `${share.label} ${formatSharePercent(share.displayPct)}%`)
    .join(", ");

  return (
    <div data-slot="card-pad" className={`${CARD_PAD_X} ${CARD_PAD_BOTTOM}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <p className="min-w-0 text-label-13 text-gray-900">
          Share of generation
          {generationGw != null ? (
            <span className="tabular-nums"> · of {generationGw} GW generation</span>
          ) : null}
        </p>
        <p className="min-w-0 text-label-13 text-gray-900" title={carbonHelp}>
          Carbon intensity{" "}
          <span className="font-semibold tabular-nums text-gray-1000">
            {carbon == null ? "—" : `${carbon.toFixed(0)} gCO₂/kWh`}
          </span>
        </p>
      </div>
      {shares.length === 0 ? (
        <div className="h-2.5 w-full rounded-sm bg-background-200 sm:h-3" aria-hidden="true" />
      ) : (
        <>
          <ul className="mb-2 flex flex-col gap-1">
            {shares.map((share) => (
              <li key={share.fuel} className="flex items-baseline justify-between gap-3">
                <span className="inline-flex min-w-0 items-center gap-1.5 text-copy-14 text-gray-1000">
                  <span
                    className="size-2 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: share.color }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">{share.label}</span>
                </span>
                <span className="shrink-0 text-right text-copy-14 tabular-nums text-gray-900">
                  {formatHeadlineGw(share.mw)} GW · {formatSharePercent(share.displayPct)}%
                </span>
              </li>
            ))}
          </ul>
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
        </>
      )}
    </div>
  );
}
