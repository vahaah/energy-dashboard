import { Card } from "@/components/ui/card";
import { NESO_BALANCING_SOURCE } from "@/lib/balancing/copy";
import { formatBalancingDate, formatMissingDays } from "@/lib/balancing/dates";
import { TYPICAL_HOUSEHOLD_KWH } from "@/lib/balancing/household";
import { formatPounds, formatShare, formatTariff } from "@/lib/balancing/money";
import type { BalancingPageModel } from "@/lib/balancing/page-model";

export function BalancingStats({ model }: { model: BalancingPageModel }) {
  const latestLabel = model.latest?.yesterday ? "Yesterday" : "Latest day";
  const missing = formatMissingDays(model.missingDates);
  const tariff = model.tariff;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap gap-4">
        <Card size="stat" titleAs="p" title={latestLabel} className="min-w-48 flex-[1_1_12rem]">
          <p className="break-words text-heading-24 tabular-nums text-gray-1000">
            {model.latest ? formatPounds(model.latest.pence) : "—"}
          </p>
          <p className="mt-1 break-words text-copy-14 text-gray-900">
            {model.latest ? formatBalancingDate(model.latest.date) : "Not yet available"}
            {model.latest?.provisional
              ? ` Incomplete: ${model.latest.periods} of ${model.latest.expectedPeriods} half-hours.`
              : ""}
          </p>
        </Card>
        <Card size="stat" titleAs="p" title="This financial year so far" className="min-w-48 flex-[1_1_12rem]">
          <p className="break-words text-heading-24 tabular-nums text-gray-1000">
            {model.fyPence == null ? "—" : formatPounds(model.fyPence)}
          </p>
          <p className="mt-1 break-words text-copy-14 text-gray-900">
            {model.fyFrom && model.fyThrough
              ? `${formatBalancingDate(model.fyFrom, false)} to ${formatBalancingDate(model.fyThrough, false)}.`
              : "Not yet available"}
            {missing ? ` ${missing} The total is partial.` : ""}
          </p>
        </Card>
        <Card size="stat" titleAs="p" title="BSUoS tariff" className="min-w-48 flex-[1_1_12rem]">
          <p className="break-words text-heading-24 tabular-nums text-gray-1000">
            {tariff ? formatTariff(tariff.gbpPerMwh) : "—"}
          </p>
          <p className="mt-1 break-words text-copy-14 text-gray-900">
            {tariff
              ? `Fixed by NESO for ${formatBalancingDate(tariff.from)} to ${formatBalancingDate(tariff.to)}.`
              : "No final tariff covers today."}
          </p>
        </Card>
        <Card size="stat" titleAs="p" title="Constraints" className="min-w-48 flex-[1_1_12rem]">
          <p className="break-words text-heading-24 tabular-nums text-gray-1000">{formatShare(model.constraintsShare)}</p>
          <p className="mt-1 break-words text-copy-14 text-gray-900">
            {model.fyFrom && model.fyThrough
              ? `of balancing cost in NESO's daily file, ${formatBalancingDate(model.fyFrom)} to ${formatBalancingDate(model.fyThrough)}.`
              : "Of the daily file for this financial year."}
          </p>
        </Card>
        <Card size="stat" titleAs="p" title="BSUoS per household" className="min-w-48 flex-[1_1_12rem]">
          <p className="break-words text-heading-24 tabular-nums text-gray-1000">
            {model.householdPence == null ? "—" : formatPounds(model.householdPence)}
          </p>
          <p className="mt-1 break-words text-copy-14 text-gray-900">
            {tariff
              ? `A year: ${formatTariff(tariff.gbpPerMwh)} × ${TYPICAL_HOUSEHOLD_KWH.toLocaleString("en-GB")} kWh (Ofgem's typical household). Excludes losses. Excluding VAT. `
              : "A year. Excludes losses. Excluding VAT. "}
            <a href="#household" className="text-blue-700 underline-offset-2 hover:underline">
              Method
            </a>
          </p>
        </Card>
      </div>
      <p className="break-words text-copy-14 text-gray-900">
        {model.fyThrough ? `Costs through ${formatBalancingDate(model.fyThrough)}. ` : ""}
        Source: {NESO_BALANCING_SOURCE}.
      </p>
    </div>
  );
}
