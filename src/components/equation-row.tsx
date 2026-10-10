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
  generationStartUtc,
  transfersStartUtc,
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
  generationStartUtc: string | null;
  transfersStartUtc: string | null;
}) {
  const transferKind = transferLabel(transfersMw);
  const transmissionNote =
    transmissionDemandMw == null
      ? ""
      : ` Transmission-only demand is ${formatHeadlineGw(transmissionDemandMw)} GW.`;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-1 sm:gap-4">
      <EquationStat
        stat={DISPLAYED_DEMAND_STAT}
        label="Demand"
        value={formatHeadlineGw(demandMw)}
        help={`${demandDefinition}.${transmissionNote} Source: ${demandSource}.`}
        source={demandSource}
        timeLabel={demandStartUtc ? formatPlainSettlementWindow(demandStartUtc) : null}
        datetime={demandStartUtc}
      />
      <span className="mb-7 text-xl font-light text-gray-700 sm:mb-8 sm:text-4xl" aria-hidden="true">
        =
      </span>
      <EquationStat
        stat="generating"
        label="Generation"
        value={formatHeadlineGw(generationMw)}
        help={`GB generation including estimated embedded wind and solar, net of pumped storage and batteries. Source: ${generationSource}.`}
        source={generationSource}
        timeLabel={generationStartUtc ? formatPlainSettlementWindow(generationStartUtc) : null}
        datetime={generationStartUtc}
      />
      <span className="mb-7 text-xl font-light text-gray-700 sm:mb-8 sm:text-4xl" aria-hidden="true">
        {transferKind.operator}
      </span>
      <EquationStat
        stat="net_imports"
        label={transferKind.label}
        value={formatHeadlineGw(transferKind.displayMw)}
        help={`Net interconnector flow. Elexon positive is an import into Great Britain. Source: ${transfersSource}.`}
        source={transfersSource}
        timeLabel={transfersStartUtc ? formatPlainSettlementWindow(transfersStartUtc) : null}
        datetime={transfersStartUtc}
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
      <p className="font-sans text-[1.75rem] leading-9 font-semibold tracking-[-0.04em] tabular-nums text-gray-1000 sm:text-display sm:leading-[3.25rem]">
        {signed ? <span className="text-gray-700">{signed}</span> : null}
        <span>{value}</span>
        <span className="text-gray-700">GW</span>
      </p>
      <p className="text-label-12 text-gray-900">
        <span data-source={source} className="hidden sm:inline">
          {source}
        </span>
        {datetime && timeLabel ? (
          <>
            <span className="hidden sm:inline">{" · "}</span>
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
  operator: string;
} {
  if (transfersMw == null) {
    return { label: "Transfers", displayMw: null, signed: "", operator: "+" };
  }
  if (Math.abs(transfersMw) < 25) {
    return { label: "Transfers", displayMw: transfersMw, signed: "", operator: "+" };
  }
  if (transfersMw > 0) {
    return { label: "Importing", displayMw: transfersMw, signed: "", operator: "+" };
  }
  return { label: "Exporting", displayMw: Math.abs(transfersMw), signed: "", operator: "−" };
}
