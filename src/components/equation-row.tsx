import { InfoTooltip } from "@/components/ui/info-tooltip";
import { DISPLAYED_DEMAND_STAT } from "@/lib/displayed-demand";
import { formatHeadlineGw } from "@/lib/facts";
import { formatPlainSettlementWindow } from "@/lib/generation-desk-view";

export function EquationRow({
  demandMw,
  generationMw,
  transfersMw,
  demandSource,
  generationSource,
  transfersSource,
  demandDefinition,
  transmissionDemandMw,
  demandStartUtc,
}: {
  demandMw: number | null;
  generationMw: number | null;
  transfersMw: number | null;
  demandSource: string;
  generationSource: string;
  transfersSource: string;
  demandDefinition: string;
  transmissionDemandMw: number | null;
  demandStartUtc: string | null;
}) {
  const transferKind = transferLabel(transfersMw);
  const timeLabel = demandStartUtc ? formatPlainSettlementWindow(demandStartUtc) : null;
  const transmissionNote =
    transmissionDemandMw == null
      ? ""
      : ` Transmission-only demand is ${formatHeadlineGw(transmissionDemandMw)} GW.`;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-end gap-2 sm:gap-4">
      <EquationStat
        stat={DISPLAYED_DEMAND_STAT}
        label="Demand"
        value={formatHeadlineGw(demandMw)}
        help={`${demandDefinition}, including estimated embedded wind and solar.${transmissionNote} Source: ${demandSource}.`}
        source={demandSource}
        timeLabel={timeLabel}
        datetime={demandStartUtc}
      />
      <span className="mb-6 text-2xl font-light text-gray-700 sm:mb-8 sm:text-4xl" aria-hidden="true">
        =
      </span>
      <EquationStat
        stat="generating"
        label="Generation"
        value={formatHeadlineGw(generationMw)}
        help={`GB generation including estimated embedded wind and solar. Source: ${generationSource}.`}
        source={generationSource}
        timeLabel={timeLabel}
        datetime={demandStartUtc}
      />
      <span className="mb-6 text-2xl font-light text-gray-700 sm:mb-8 sm:text-4xl" aria-hidden="true">
        +
      </span>
      <EquationStat
        stat="net_imports"
        label={transferKind.label}
        value={formatHeadlineGw(transferKind.displayMw)}
        help={`Net interconnector flow. Positive is an import into Great Britain. Source: ${transfersSource}.`}
        source={transfersSource}
        timeLabel={timeLabel}
        datetime={demandStartUtc}
        signed={transferKind.signed}
      />
    </div>
  );
}

function EquationStat({
  stat,
  label,
  value,
  help,
  source,
  timeLabel,
  datetime,
  signed,
}: {
  stat: string;
  label: string;
  value: string;
  help: string;
  source: string;
  timeLabel: string | null;
  datetime: string | null;
  signed?: string;
}) {
  return (
    <div data-stat={stat} className="min-w-0">
      <div className="flex items-center gap-1">
        <p className="text-label-13 text-gray-900">{label}</p>
        <InfoTooltip text={help} label={`What is ${label}?`} />
      </div>
      <p className="text-display font-sans tabular-nums text-gray-1000">
        {signed ? <span className="text-gray-700">{signed}</span> : null}
        <span>{value}</span>
        <span className="text-display text-gray-700">GW</span>
      </p>
      <p className="text-label-12 text-gray-900">
        <span data-source={source}>{source}</span>
        {datetime && timeLabel ? (
          <>
            {" · "}
            <time className="text-mono-12" dateTime={datetime}>
              {timeLabel}
            </time>
          </>
        ) : null}
      </p>
    </div>
  );
}

function transferLabel(transfersMw: number | null): {
  label: string;
  displayMw: number | null;
  signed: string;
} {
  if (transfersMw == null) {
    return { label: "Transfers", displayMw: null, signed: "" };
  }
  if (Math.abs(transfersMw) < 25) {
    return { label: "Transfers", displayMw: transfersMw, signed: "" };
  }
  if (transfersMw > 0) {
    return { label: "Importing", displayMw: transfersMw, signed: "" };
  }
  return { label: "Exporting", displayMw: Math.abs(transfersMw), signed: "" };
}
