import { Card, CardEmpty } from "@/components/ui/card";
import { NESO_OPEN_DATA_ATTRIBUTION } from "@/lib/attribution";
import { NESO_BALANCING_SOURCE } from "@/lib/balancing/copy";
import { formatBalancingDate } from "@/lib/balancing/dates";
import { formatPounds } from "@/lib/balancing/money";
import type { HomeCardFile } from "@/lib/balancing/types";

function shortDate(iso: string): string {
  return formatBalancingDate(iso, false);
}

/** Prepared release only. The card does not import MapLibre. */
export function BalancingHomeCard({ card }: { card: HomeCardFile | null }) {
  if (
    !card ||
    card.latest_pence == null ||
    card.fy_pence == null ||
    card.latest_date == null ||
    card.fy_from == null ||
    card.fy_through == null
  ) {
    return (
      <Card title="Balancing cost" footer={`Source: ${NESO_BALANCING_SOURCE}. ${NESO_OPEN_DATA_ATTRIBUTION}`}>
        <CardEmpty>Balancing cost is not available for this period. This is missing data, not zero.</CardEmpty>
      </Card>
    );
  }
  const latest = card.latest_incomplete
    ? `${formatPounds(card.latest_pence)} on ${shortDate(card.latest_date)} (incomplete: ${card.latest_periods} of ${card.latest_expected_periods} half-hours).`
    : `${formatPounds(card.latest_pence)} on ${shortDate(card.latest_date)}.`;
  const missing =
    card.missing_dates.length === 0
      ? ""
      : ` (${card.missing_dates.map((date) => shortDate(date)).join(", ")} missing)`;
  return (
    <Card title="Balancing cost" footer={`Source: ${NESO_BALANCING_SOURCE}. ${NESO_OPEN_DATA_ATTRIBUTION}`}>
      <p className="break-words text-copy-16 text-gray-1000">What NESO paid to keep supply and demand matched.</p>
      <p className="mt-2 break-words text-copy-16 text-gray-1000" data-balancing-card>
        <span className="tabular-nums">{latest}</span>
      </p>
      <p className="mt-2 break-words text-copy-16 text-gray-1000">
        <span className="tabular-nums">
          {formatPounds(card.fy_pence)} this financial year, {shortDate(card.fy_from)} to {shortDate(card.fy_through)}
          {missing}.
        </span>
      </p>
      <a
        href="/system/balancing"
        className="mt-3 inline-flex h-11 items-center text-copy-14 text-blue-700 underline-offset-2 hover:underline"
      >
        What balancing costs, and who pays
      </a>
    </Card>
  );
}
