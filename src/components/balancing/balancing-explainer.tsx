import Link from "next/link";
import { CC_BY_4_0_LICENSE_URL, ELEXON_BMRS_LICENCE_URL, NESO_OPEN_DATA_ATTRIBUTION, NESO_OPEN_DATA_LICENCE_URL, elexonBmrsAttribution } from "@/lib/attribution";
import {
  BALANCING_FAQS,
  DUKES_CHAPTER_5_URL,
  NESO_BALANCING_BLOG_PART2_URL,
  NESO_BALANCING_BLOG_URL,
  NESO_BALANCING_HEADLINE,
  NESO_BALANCING_HEADLINE_YEAR,
  NESO_BSUOS_TARIFF_URL,
  NESO_DAILY_BALANCING_URL,
  NESO_WIND_TURNDOWN,
  OFGEM_CAP_AND_FLOOR_URL,
  TRADE_LABEL,
} from "@/lib/balancing/copy";
import { formatBalancingDate } from "@/lib/balancing/dates";
import { OFGEM_TDCV_URL } from "@/lib/balancing/household";
import type { BalancingFaq } from "@/lib/balancing/leads";
import { whoPaysAnswer } from "@/lib/balancing/leads";
import { formatPounds, formatShare, formatTariff } from "@/lib/balancing/money";
import type { BalancingPageModel } from "@/lib/balancing/page-model";

const LINK = "text-blue-700 underline-offset-2 hover:underline";

export function BalancingExplainer({
  model,
  faqs,
}: {
  model: BalancingPageModel;
  faqs: readonly BalancingFaq[];
}) {
  const year = new Date().getUTCFullYear();
  const share = formatShare(model.constraintsShare);
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <section id="what" className="max-w-3xl scroll-mt-28">
        <h2 className="text-heading-24 text-gray-1000">What balancing is</h2>
        <p className="mt-3 break-words text-copy-16 text-gray-900">{BALANCING_FAQS[0].answer}</p>
      </section>
      <section id="tools" className="max-w-3xl scroll-mt-28">
        <h2 className="text-heading-24 text-gray-1000">The tools</h2>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-copy-16 text-gray-900">
          <li>Balancing Mechanism bids (turn down) and offers (turn up), at the price each unit offers.</li>
          <li>Reserve, held ready to respond.</li>
          <li>Frequency response, on a scale of seconds.</li>
          <li>Voltage and inertia services.</li>
          <li>Trades, including trades with interconnectors. Those trades already sit inside the balancing categories.</li>
        </ul>
      </section>
      <section id="why" className="max-w-3xl scroll-mt-28">
        <h2 className="text-heading-24 text-gray-1000">Why it costs money</h2>
        <p className="mt-3 break-words text-copy-16 text-gray-900">
          NESO puts thermal constraints, limits on how much the grid can carry and especially the B6 boundary from
          Scotland into England, at around two-thirds of its broader {NESO_BALANCING_HEADLINE_YEAR} balancing total of{" "}
          {NESO_BALANCING_HEADLINE} (
          <a className={LINK} href={NESO_BALANCING_BLOG_URL}>
            The balancing act
          </a>
          , 3 Nov 2026). On this page the Constraints category is a narrower daily total
          {model.constraintsShare == null ? "" : `, ${share} of the six-category file this financial year so far`}. NESO
          says turn-up of replacement plant, often gas, is the larger part of constraint cost. Some turn-down payments
          to wind cover ROCs or CfDs that would have been paid if the plant had generated. NESO also says {NESO_WIND_TURNDOWN}{" "}
          was paid to wind farms to turn down in {NESO_BALANCING_HEADLINE_YEAR}. That wind figure is not the Constraints
          category (
          <a className={LINK} href={NESO_BALANCING_BLOG_PART2_URL}>
            Part 2: Outturn
          </a>
          , 9 Nov 2026). Constraint cost and volume are also on{" "}
          <Link className={LINK} href="/system/constraints">
            the constraints page
          </Link>
          .
        </p>
      </section>
      <section id="household" className="max-w-3xl scroll-mt-28">
        <h2 className="text-heading-24 text-gray-1000">Who pays</h2>
        <p className="mt-3 break-words text-copy-16 text-gray-900">{whoPaysAnswer(model)}</p>
        <p className="mt-3 break-words text-copy-16 text-gray-900">
          BSUoS also covers NESO&apos;s running costs.{" "}
          {model.tariff
            ? `The final tariff covering today is ${formatTariff(model.tariff.gbpPerMwh)}, ${model.tariff.title}, ${formatBalancingDate(model.tariff.from)} to ${formatBalancingDate(model.tariff.to)}.`
            : "No final tariff on the file covers today."}{" "}
          {model.draft
            ? `A draft of ${formatTariff(model.draft.gbpPerMwh)} is published for ${formatBalancingDate(model.draft.from)} to ${formatBalancingDate(model.draft.to)}.`
            : ""}{" "}
          The household figure is {model.householdPence == null ? "not available" : `${formatPounds(model.householdPence)} a year`}.{" "}
          <a className={LINK} href={OFGEM_TDCV_URL}>
            Ofgem&apos;s typical domestic consumption values
          </a>{" "}
          set 2,500 kWh from 1 Jul 2026. Tariffs are on the{" "}
          <a className={LINK} href={NESO_BSUOS_TARIFF_URL}>
            NESO fixed tariff file
          </a>
          .
        </p>
      </section>
      <section id="magnitudes" className="max-w-3xl scroll-mt-28">
        <h2 className="text-heading-24 text-gray-1000">Two totals for the same year</h2>
        <p className="mt-3 break-words text-copy-16 text-gray-900">
          NESO&apos;s Chief Economist put balancing costs at {NESO_BALANCING_HEADLINE} in {NESO_BALANCING_HEADLINE_YEAR}{" "}
          (3 Nov and 9 Nov 2026). The 2025/26 annual report is not yet published. The daily file on this page is a
          narrower set of six categories
          {model.dailyFy2526Pence == null ? "" : `, ${formatPounds(model.dailyFy2526Pence)} in ${NESO_BALANCING_HEADLINE_YEAR}`}
          . A day is the sum of those six categories, and a year is the sum of its days. The two totals are not added
          together. This page uses the daily file.
        </p>
      </section>
      <section id="interconnectors" className="max-w-3xl scroll-mt-28">
        <h2 className="text-heading-24 text-gray-1000">Interconnectors and trade</h2>
        <p className="mt-3 break-words text-copy-16 text-gray-900">{BALANCING_FAQS[2].answer}</p>
        <p className="mt-3 break-words text-copy-16 text-gray-900">{TRADE_LABEL}</p>
        <p className="mt-3 break-words text-copy-16 text-gray-900">
          Cables run to France, Belgium, the Netherlands, Norway, Denmark, Ireland and Northern Ireland. In 2025 DESNZ
          recorded UK imports of 43.9 TWh and UK exports of 14.2 TWh, 29.7 TWh net. Those DUKES figures are for the
          United Kingdom, not Great Britain.{" "}
          <a className={LINK} href={DUKES_CHAPTER_5_URL}>
            DUKES 2026, chapter 5
          </a>
          .
        </p>
        <p className="mt-3 break-words text-copy-16 text-gray-900">
          Traders and suppliers settle the power. When the price differs on each side, the gap is congestion rent and
          goes to the interconnector owners. Not every link is in the cap and floor. Where it applies, income above the
          cap comes back through lower network charges, and income below the floor is topped up from those charges (
          <a className={LINK} href={OFGEM_CAP_AND_FLOOR_URL}>
            Ofgem&apos;s cap and floor handbook
          </a>
          ). NESO&apos;s own interconnector trades are already inside the balancing categories and are not added again.
        </p>
      </section>
      <section id="bring-down" className="max-w-3xl scroll-mt-28">
        <h2 className="text-heading-24 text-gray-1000">What NESO says would lower it</h2>
        <p className="mt-3 break-words text-copy-16 text-gray-900">
          NESO points to new circuits from north to south, including the Eastern Green Links, and less exposure to the
          gas price. NESO also says that, without the wind, the gas would still have to run. Most of the constraint
          cost is the replacement energy, not the payment to turn wind down. See{" "}
          <a className={LINK} href={NESO_BALANCING_BLOG_URL}>
            The balancing act
          </a>
          .
        </p>
      </section>
      <section id="method" className="max-w-3xl scroll-mt-28">
        <h2 className="text-heading-24 text-gray-1000">Methodology and limits</h2>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-copy-16 text-gray-900">
          <li>NESO and Elexon revise files after first publication. Grid checks once a day and keeps the revision.</li>
          <li>A day with fewer half-hours than the clock is marked incomplete. It is not filled out.</li>
          <li>A day that is missing from the file is left as a gap. It is not filled with zero. A year-to-date total that skips a day is partial.</li>
          <li>A negative category is a negative number. It is not dropped and it is not flipped.</li>
          <li>History runs from the 2017/18 financial year.</li>
          <li>The trade estimate skips a half-hour that has flow and no Market index price, and marks that day incomplete.</li>
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
          . Grid&apos;s derived data is{" "}
          <a className={LINK} href={CC_BY_4_0_LICENSE_URL}>
            CC BY 4.0
          </a>
          . More on the method is in{" "}
          <Link className={LINK} href="/methodology#balancing">
            methodology
          </Link>
          , with the sources on{" "}
          <Link className={LINK} href="/data-sources">
            data sources
          </Link>{" "}
          and freshness on{" "}
          <Link className={LINK} href="/data-health">
            data health
          </Link>
          .
        </p>
      </section>
      <section id="faq" className="max-w-3xl scroll-mt-28">
        <h2 className="text-heading-24 text-gray-1000">Frequently asked questions</h2>
        <dl className="mt-3 flex flex-col gap-4">
          {faqs.map((faq) => (
            <div key={faq.question}>
              <dt className="text-heading-16 text-gray-1000">{faq.question}</dt>
              <dd className="mt-1 break-words text-copy-16 text-gray-900">{faq.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
