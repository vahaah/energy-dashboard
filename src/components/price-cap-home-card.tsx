import Link from "next/link";
import { Card } from "@/components/ui/card";
import { priceCapHomeCardCopy } from "@/lib/price-cap";

/** Static Ofgem figure. The card does not import MapLibre or read Tinybird. */
export function PriceCapHomeCard() {
  const copy = priceCapHomeCardCopy();
  return (
    <Card title="Price cap" footer="Source: Ofgem.">
      <p className="break-words text-copy-16 text-gray-1000">
        Typical dual-fuel Direct Debit, 1 January to 31 March 2027.
      </p>
      <p className="mt-2 break-words text-copy-16 text-gray-1000" data-price-cap-card>
        <span className="tabular-nums">{copy.figure}</span>
      </p>
      <p className="mt-2 break-words text-copy-16 text-gray-1000">{copy.detail}</p>
      <Link
        href="/explained/price-cap"
        className="mt-3 inline-flex h-11 items-center text-copy-14 text-blue-700 underline-offset-2 hover:underline"
      >
        January 2027 price cap
      </Link>
    </Card>
  );
}
