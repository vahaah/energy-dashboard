import { InfoTooltip } from "@/components/ui/info-tooltip";
import { formatHeadlineGw } from "@/lib/facts";
import type { PeriodAverages } from "@/lib/historic-mix";

export function PeriodAveragesRow({
  averages,
  neso,
}: {
  averages: PeriodAverages;
  neso: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <AverageStat
        label="Price"
        value={
          averages.priceGbpMwh == null ? (neso ? "n/a" : "—") : averages.priceGbpMwh.toFixed(1)
        }
        unit={averages.priceGbpMwh == null ? "" : "£/MWh"}
        caption={neso && averages.priceGbpMwh == null ? "Not in NESO mix" : null}
        help={
          neso
            ? "Market prices are not in the NESO historic mix, so Year and All time show n/a. Source: Elexon Market Index on Day and Week."
            : "Average short-term wholesale market price (Market Index) over the selected window. Source: Elexon BMRS."
        }
      />
      <AverageStat
        label="Carbon"
        value={averages.carbon == null ? "—" : averages.carbon.toFixed(0)}
        unit={averages.carbon == null ? "" : "g"}
        help={
          neso
            ? "Average carbon intensity from NESO historic generation mix. Supported by National Energy SO Open Data."
            : "Average national carbon intensity over the selected window. Source: Carbon Intensity API."
        }
      />
      <AverageStat
        label="Demand"
        value={formatHeadlineGw(averages.demandMw)}
        unit="GW"
        help={
          neso
            ? "Average NESO historic generation, which already includes imports and storage. Supported by National Energy SO Open Data."
            : "Average demand including estimated embedded wind and solar."
        }
      />
      <AverageStat
        label="Generation"
        value={formatHeadlineGw(averages.generationMw)}
        unit="GW"
        help={
          neso
            ? "Average GB generation excluding interconnectors. Source: NESO historic mix."
            : "Average GB generation including estimated embedded wind and solar."
        }
      />
      <AverageStat
        label="Transfers"
        value={formatHeadlineGw(averages.transfersMw)}
        unit="GW"
        help={
          neso
            ? "Average interconnector imports in the NESO historic mix. Signed net transfers are not published there."
            : "Average net interconnector flow. Positive is an import into Great Britain."
        }
      />
    </div>
  );
}

function AverageStat({
  label,
  value,
  unit,
  help,
  caption = null,
}: {
  label: string;
  value: string;
  unit: string;
  help: string;
  caption?: string | null;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1">
        <p className="text-label-13 text-gray-900">{label}</p>
        <InfoTooltip text={help} label={`What is ${label}?`} />
      </div>
      <p data-figure className="mt-1 whitespace-nowrap font-sans text-heading-24 tabular-nums text-gray-1000">
        <span data-value>{value}</span>
        {unit ? (
          <span data-unit className="align-baseline text-gray-700">
            {unit}
          </span>
        ) : null}
      </p>
      {caption ? <p className="text-label-12 text-gray-900">{caption}</p> : null}
    </div>
  );
}
