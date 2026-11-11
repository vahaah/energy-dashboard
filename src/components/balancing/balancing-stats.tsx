import { Card } from "@/components/ui/card";
import { formatPounds, formatShare, formatTariff } from "@/lib/balancing/money";
import type { BalancingPageModel } from "@/lib/balancing/page-model";

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) {
    return iso;
  }
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

export function BalancingStats({ model }: { model: BalancingPageModel }) {
  const latestLabel = model.latest?.yesterday ? "Yesterday" : "Latest day";
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <Card size="stat" title={latestLabel}>
        <p className="break-words text-heading-24 tabular-nums text-gray-1000">
          {model.latest ? formatPounds(model.latest.pence) : "—"}
        </p>
        <p className="mt-1 break-words text-copy-14 text-gray-900">
          {model.latest ? formatDate(model.latest.date) : "Not yet available"}
          {model.latest?.provisional ? " · Provisional" : ""}
        </p>
      </Card>
      <Card size="stat" title={`FY ${model.financialYearLabel} to date`}>
        <p className="break-words text-heading-24 tabular-nums text-gray-1000">
          {model.fyPence == null ? "—" : formatPounds(model.fyPence)}
        </p>
        <p className="mt-1 break-words text-copy-14 text-gray-900">
          {model.fyThrough ? `Through ${formatDate(model.fyThrough)}` : "Not yet available"}
        </p>
      </Card>
      <Card size="stat" title="BSUoS tariff">
        <p className="break-words text-heading-24 tabular-nums text-gray-1000">
          {model.tariff ? formatTariff(model.tariff.gbpPerMwh) : "—"}
        </p>
        <p className="mt-1 break-words text-copy-14 text-gray-900">{model.tariff?.label ?? "No final tariff covers today"}</p>
      </Card>
      <Card size="stat" title="Constraints share">
        <p className="break-words text-heading-24 tabular-nums text-gray-1000">{formatShare(model.constraintsShare)}</p>
        <p className="mt-1 break-words text-copy-14 text-gray-900">Of this financial year, so far</p>
      </Card>
      <Card size="stat" title="Per household">
        <p className="break-words text-heading-24 tabular-nums text-gray-1000">
          {model.householdPence == null ? "—" : formatPounds(model.householdPence)}
        </p>
        <p className="mt-1 break-words text-copy-14 text-gray-900">
          A year, before losses and VAT.{" "}
          <a href="#household" className="text-blue-700 underline-offset-2 hover:underline">
            Method
          </a>
        </p>
      </Card>
    </div>
  );
}
