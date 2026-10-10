import { Sparkline } from "@/components/sparkline";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { FUEL_COLORS } from "@/lib/colors";
import { formatGridFetchedAt, type LookAheadView } from "@/lib/forecast-model";

export function LookAheadStrip({ lookAhead }: { lookAhead: LookAheadView }) {
  if (!lookAhead.greenest && !lookAhead.wind) {
    return null;
  }

  return (
    <div className="mt-6 border-t border-gray-alpha-400 pt-5">
      <p className="text-label-13 text-gray-900">Look-ahead</p>
      {lookAhead.greenest ? (
        <p className="mt-2 text-copy-16 text-gray-1000">
          <a
            href="#section-carbon"
            className="underline decoration-gray-alpha-400 underline-offset-2 hover:text-gray-1000"
          >
            {lookAhead.greenest.sentence}
          </a>
        </p>
      ) : null}
      {lookAhead.wind ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Sparkline
            values={lookAhead.wind.sparkline}
            color={FUEL_COLORS.wind}
            label="Transmission-connected wind forecast"
          />
          <p className="text-copy-16 text-gray-1000">{lookAhead.wind.sentence}</p>
          <InfoTooltip
            text={`${lookAhead.wind.basis} Source: Elexon WINDFOR.`}
            label="What is the wind forecast?"
          />
        </div>
      ) : null}
      <p className="mt-2 text-label-12 text-gray-900">
        {formatGridFetchedAt(lookAhead.fetchedAt)}
        {lookAhead.wind ? " · Elexon WINDFOR" : null}
        {lookAhead.greenest ? " · NESO Carbon Intensity API" : null}
      </p>
    </div>
  );
}
