import {
  BALANCING_FAQS,
  DUKES_CHAPTER_5_URL,
  NESO_BALANCING_COSTS_URL,
  NESO_BSUOS_TARIFF_URL,
  NESO_DAILY_BALANCING_URL,
  NESO_MBSS_HEADLINE,
  NESO_MBSS_YEAR,
  OFGEM_INTERCONNECTORS_URL,
  OFGEM_TYPICAL_USE_URL,
  TRADE_LABEL,
} from "@/lib/balancing/copy";
import { HOUSEHOLD_METHOD, TYPICAL_HOUSEHOLD_KWH } from "@/lib/balancing/household";
import { formatPounds, formatTariff } from "@/lib/balancing/money";
import type { BalancingPageModel } from "@/lib/balancing/page-model";
import { ELEXON_BMRS_LICENCE_URL, NESO_OPEN_DATA_ATTRIBUTION, NESO_OPEN_DATA_LICENCE_URL, elexonBmrsAttribution } from "@/lib/attribution";

const LINK = "text-blue-700 underline-offset-2 hover:underline";

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) {
    return iso;
  }
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

export function BalancingExplainer({ model }: { model: BalancingPageModel }) {
  const year = new Date().getUTCFullYear();
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <section className="max-w-3xl">
        <h2 className="text-heading-24 text-gray-1000">What balancing is</h2>
        <p className="mt-3 break-words text-copy-16 text-gray-900">{BALANCING_FAQS[0].answer}</p>
      </section>
      <section className="max-w-3xl">
        <h2 className="text-heading-24 text-gray-1000">The tools</h2>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-copy-16 text-gray-900">
          <li>Balancing Mechanism bids (turn down) and offers (turn up), at the price each unit offers.</li>
          <li>Reserve, held ready to respond.</li>
          <li>Frequency response, on a scale of seconds.</li>
          <li>Voltage and inertia services.</li>
          <li>Trades, including trades with interconnectors. Those trades already sit inside the balancing categories.</li>
        </ul>
      </section>
      <section className="max-w-3xl">
        <h2 className="text-heading-24 text-gray-1000">Why it costs money</h2>
        <p className="mt-3 break-words text-copy-16 text-gray-900">
          Constraints are about two-thirds of the cost, and sometimes more. Wind in Scotland cannot all cross the B6
          boundary into England, so NESO pays it to turn down, often for less than the subsidy it loses. Gas plant in
          England and Wales is paid to turn up in its place. The turn-up is the larger part of the money, and the gas
          price drives it.{" "}
          <a className={LINK} href={NESO_BALANCING_COSTS_URL}>
            NESO describes the same split
          </a>
          .
        </p>
      </section>
      <section id="household" className="max-w-3xl scroll-mt-28">
        <h2 className="text-heading-24 text-gray-1000">Who pays</h2>
        <p className="mt-3 break-words text-copy-16 text-gray-900">
          NESO recovers the cost through BSUoS, a fixed tariff per MWh set about six months ahead. Suppliers pass it
          into bills. NESO puts balancing at about 4.3% of a typical household bill.
        </p>
        <p className="mt-3 break-words text-copy-16 text-gray-900">
          {model.tariff
            ? `The final tariff covering today is ${formatTariff(model.tariff.gbpPerMwh)} (${model.tariff.label}).`
            : "No final tariff on the file covers today."}{" "}
          {model.draft
            ? `A draft of ${formatTariff(model.draft.gbpPerMwh)} is published for ${formatDate(model.draft.from)} to ${formatDate(model.draft.to)}.`
            : ""}{" "}
          The per-household figure is {model.householdPence == null ? "not available" : formatPounds(model.householdPence)} a
          year. {HOUSEHOLD_METHOD} {TYPICAL_HOUSEHOLD_KWH.toLocaleString("en-GB")} kWh is{" "}
          <a className={LINK} href={OFGEM_TYPICAL_USE_URL}>
            Ofgem&apos;s typical medium household
          </a>
          . Tariffs are on the{" "}
          <a className={LINK} href={NESO_BSUOS_TARIFF_URL}>
            NESO fixed tariff file
          </a>
          .
        </p>
      </section>
      <section className="max-w-3xl">
        <h2 className="text-heading-24 text-gray-1000">Typical magnitudes</h2>
        <p className="mt-3 break-words text-copy-16 text-gray-900">
          NESO&apos;s broader monthly summary put balancing services at {NESO_MBSS_HEADLINE} in {NESO_MBSS_YEAR}. The
          daily dataset on this page is a narrower set of six categories
          {model.dailyFy2526Pence == null ? "" : `, ${formatPounds(model.dailyFy2526Pence)} in ${NESO_MBSS_YEAR}`}. The
          two figures use different definitions. They are not added together. The daily file is the one that
          reconciles: each day is the sum of the six categories, and a financial year is the sum of its days.
        </p>
      </section>
      <section className="max-w-3xl">
        <h2 className="text-heading-24 text-gray-1000">Interconnectors and trade</h2>
        <p className="mt-3 break-words text-copy-16 text-gray-900">{TRADE_LABEL}.</p>
        <p className="mt-3 break-words text-copy-16 text-gray-900">
          Cables run to France, Belgium, the Netherlands, Norway, Denmark, Ireland and Northern Ireland. Power flows
          toward the higher price. Great Britain is a large net importer. In 2025 DESNZ recorded 43.9 TWh imported and
          14.2 TWh exported, 29.7 TWh net.{" "}
          <a className={LINK} href={DUKES_CHAPTER_5_URL}>
            DUKES 2026, chapter 5
          </a>
          .
        </p>
        <p className="mt-3 break-words text-copy-16 text-gray-900">
          Traders and suppliers settle the power. When the price differs on each side, the gap is congestion rent and
          goes to the interconnector owners. Under{" "}
          <a className={LINK} href={OFGEM_INTERCONNECTORS_URL}>
            Ofgem&apos;s cap and floor
          </a>
          , part of that rent can come back to consumers through network charges, or a shortfall can be topped up.
          Imports often reduce the price in Great Britain, so a large import value is not a loss. NESO&apos;s own
          interconnector trades are already inside the balancing categories and are not added again.
        </p>
        <p className="mt-3 break-words text-copy-16 text-gray-900">
          For 2025 this estimate was within 2.4% of HMRC trade statistics on imports and 0.7% on exports. Half-hours
          with no market price were left out.
        </p>
      </section>
      <section className="max-w-3xl">
        <h2 className="text-heading-24 text-gray-1000">What brings the cost down</h2>
        <p className="mt-3 break-words text-copy-16 text-gray-900">
          New circuits from north to south, including the Eastern Green Links, storage close to demand, sharper
          locational signals, and less exposure to gas. NESO also makes the point that, without the wind, the gas
          would still have to run. Most of the constraint cost is the replacement energy, not the payment to turn wind
          down.
        </p>
      </section>
      <section className="max-w-3xl" id="method">
        <h2 className="text-heading-24 text-gray-1000">Methodology and limits</h2>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-copy-16 text-gray-900">
          <li>NESO and Elexon revise files after first publication. Grid checks once a day and keeps the revision.</li>
          <li>The latest day can be short of a full set of settlement periods. It is marked provisional.</li>
          <li>A day that is missing from the file is left as a gap. It is not filled with zero.</li>
          <li>A negative category is a negative number. It is not dropped and it is not flipped.</li>
          <li>History runs from the 2017/18 financial year. NESO changes the resource id each April. Grid looks the id up by name.</li>
          <li>The trade estimate skips a half-hour that has flow and no Market Index price, and marks that day provisional.</li>
          <li>INTNESO, the residual imports bucket, is not drawn and is not valued.</li>
        </ul>
        <p className="mt-3 break-words text-copy-14 text-gray-900">
          <a className={LINK} href={NESO_DAILY_BALANCING_URL}>
            Daily balancing costs
          </a>
          . {NESO_OPEN_DATA_ATTRIBUTION}.{" "}
          <a className={LINK} href={NESO_OPEN_DATA_LICENCE_URL}>
            NESO Open Data Licence
          </a>
          . {elexonBmrsAttribution(year)}{" "}
          <a className={LINK} href={ELEXON_BMRS_LICENCE_URL}>
            Elexon BMRS licence
          </a>
          .
        </p>
      </section>
    </div>
  );
}
