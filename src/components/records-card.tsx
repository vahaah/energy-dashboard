import Link from "next/link";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { COAL_POWER_ENDED, type GridRecords } from "@/lib/historic-mix";
import { NESO_OPEN_DATA_ATTRIBUTION } from "@/lib/attribution";
import { formatHeadlineGw } from "@/lib/facts";
import { formatLondonDateTimeStamp, formatLondonDayMonthYear, parseUtcDateTime } from "@/lib/london-time";

export function RecordsCard({ records }: { records: GridRecords }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <RecordStat
        label="Highest wind since Grid's records began"
        value={formatHeadlineGw(records.maxWind?.value ?? null)}
        unit="GW"
        when={records.maxWind?.timestampUtc}
        help={`${records.maxWind?.basis ?? "Wind record."} ${NESO_OPEN_DATA_ATTRIBUTION}.`}
      />
      <RecordStat
        label="Lowest carbon since Grid's records began"
        value={records.lowestCarbon ? records.lowestCarbon.value.toFixed(0) : "—"}
        unit={records.lowestCarbon ? "g" : ""}
        when={records.lowestCarbon?.timestampUtc}
        help={`${records.lowestCarbon?.basis ?? "Lowest carbon half-hour."} ${NESO_OPEN_DATA_ATTRIBUTION}.`}
      />
      <RecordStat
        label="Days since coal power ended"
        value={records.daysSinceCoal == null ? "—" : String(records.daysSinceCoal)}
        unit=""
        whenLabel={records.lastCoal ? formatLondonDayMonthYear(COAL_POWER_ENDED) : undefined}
        help={`${records.lastCoal?.basis ?? "Days since coal power ended."} ${NESO_OPEN_DATA_ATTRIBUTION}.`}
      />
      <p className="text-label-12 text-gray-900 sm:col-span-2 xl:col-span-4">
        <Link href="/records" className="text-blue-700 underline-offset-2 hover:underline">
          All records and wind milestones
        </Link>
        <span className="text-gray-900"> · {NESO_OPEN_DATA_ATTRIBUTION}</span>
      </p>
    </div>
  );
}

function RecordStat({
  label,
  value,
  unit,
  when,
  whenLabel,
  help,
}: {
  label: string;
  value: string;
  unit: string;
  when?: string;
  whenLabel?: string;
  help: string;
}) {
  const stamp = whenLabel ?? (when ? formatLondonDateTimeStamp(parseUtcDateTime(when)) : null);

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1">
        <p className="text-label-13 text-gray-900">{label}</p>
        <InfoTooltip text={help} label={`What is ${label}?`} />
      </div>
      <p data-figure className="mt-1 whitespace-nowrap font-sans text-heading-24 tabular-nums text-gray-1000">
        <span data-value>{value}</span>
        {unit ? (
          <span data-unit className="align-baseline unit-label font-medium text-gray-900">
            {unit}
          </span>
        ) : null}
      </p>
      {stamp ? <p className="mt-1 text-mono-12 text-gray-900">{stamp}</p> : null}
    </div>
  );
}
