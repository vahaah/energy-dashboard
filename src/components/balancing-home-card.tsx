import { Card, CardEmpty } from "@/components/ui/card";
import { NESO_OPEN_DATA_ATTRIBUTION } from "@/lib/attribution";
import { formatPounds } from "@/lib/balancing/money";
import type { HomeCardFile } from "@/lib/balancing/types";
import cardFile from "@/lib/balancing/home-card.json";

const card = cardFile as HomeCardFile;

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) {
    return iso;
  }
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

function financialYearLabel(id: string): string {
  const match = /^(\d{4})-(\d{4})$/.exec(id);
  if (!match?.[1] || !match[2]) {
    return id;
  }
  return `${match[1]}/${match[2].slice(2)}`;
}

/** Prepared file only. The homepage does not read Blob and does not import MapLibre. */
export function BalancingHomeCard() {
  if (card.latest_pence == null || card.fy_pence == null || card.latest_date == null || card.financial_year == null) {
    return (
      <Card title="Balancing cost" footer={NESO_OPEN_DATA_ATTRIBUTION}>
        <CardEmpty>Balancing cost is not available for this edition.</CardEmpty>
      </Card>
    );
  }
  const when = card.latest_provisional ? `${formatDate(card.latest_date)}, provisional` : formatDate(card.latest_date);
  return (
    <Card title="Balancing cost" footer={NESO_OPEN_DATA_ATTRIBUTION}>
      <p className="break-words text-copy-16 text-gray-1000" data-balancing-card>
        <span className="tabular-nums">{formatPounds(card.latest_pence)}</span>
        <span className="text-gray-900"> on {when}.</span>
      </p>
      <p className="mt-2 break-words text-copy-16 text-gray-1000">
        <span className="tabular-nums">{formatPounds(card.fy_pence)}</span>
        <span className="text-gray-900"> so far in {financialYearLabel(card.financial_year)}.</span>
      </p>
      <a
        href="/system/balancing"
        className="mt-3 inline-flex h-11 items-center text-copy-14 text-blue-700 underline-offset-2 hover:underline"
      >
        Balancing
      </a>
    </Card>
  );
}
