import { DataStateNotice } from "@/components/ui/data-state";
import { CARD_PAD_X } from "@/components/ui/card";
import { ABSENT_FIGURE } from "@/lib/data-state";
import { balanceEquationSentence, type DisplayedPower, type HeadlineTerm } from "@/lib/displayed-demand";
import { homepageDemandFigureInputs } from "@/lib/metrics";

const PERIOD_ID = "balance-period";

/** 2.25rem through the lg band, 3rem once the card container clears 1102px. */
const DESK_FIGURE = "text-[2.25rem] @min-[1102px]:text-[3rem]";

const LEDGER_FIGURE = "text-[1.5rem] md:text-[1.75rem]";
const LEDGER_DEMAND_FIGURE = "text-[1.75rem] md:text-[2rem]";

const UNIT_CLASS = "ml-[0.15em] align-baseline unit-label font-medium tracking-normal text-gray-900";

/**
 * Term columns are `minmax(0, 1fr)`. A closed equation inserts a `2.5rem`
 * operator track between terms, so four terms drop one pair from the five-term template.
 */
export function equationGridTemplate(termCount: number, closed: boolean): string {
  const count = Math.max(termCount, 1);
  if (!closed) {
    return `repeat(${count}, minmax(0, 1fr))`;
  }
  const tracks = ["minmax(0, 1fr)"];
  for (let index = 1; index < count; index += 1) {
    tracks.push("2.5rem", "minmax(0, 1fr)");
  }
  return tracks.join(" ");
}

export function EquationRow({ power }: { power: DisplayedPower }) {
  const sentence = balanceEquationSentence(power);

  return (
    <div data-slot="card-pad" className={`relative overflow-x-clip ${CARD_PAD_X}`}>
      <p className="sr-only">{sentence}</p>
      <dl
        data-balanced={power.balanceClosed ? "true" : "false"}
        data-equation="horizontal"
        aria-hidden="true"
        className="hidden grid-rows-[auto_auto_auto] gap-x-0 pt-8 pb-7 lg:grid"
        style={{ gridTemplateColumns: equationGridTemplate(power.terms.length, power.balanceClosed) }}
      >
        {power.terms.map((term, index) => (
          <EquationTerm key={term.id} term={term} index={index} closed={power.balanceClosed} />
        ))}
      </dl>
      <div
        data-equation="ledger"
        className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(7.75rem,auto)] items-baseline gap-y-3 pt-2 lg:hidden"
        aria-hidden="true"
      >
        {power.terms.map((term) => (
          <LedgerRow key={term.id} term={term} />
        ))}
      </div>
      {power.terms.some((term) => term.displayGw === ABSENT_FIGURE) ? (
        <div className="mt-3">
          <DataStateNotice state="not_yet_available" />
        </div>
      ) : null}
    </div>
  );
}

export function balancePeriodId(): string {
  return PERIOD_ID;
}

function EquationTerm({ term, index, closed }: { term: HeadlineTerm; index: number; closed: boolean }) {
  const demand = term.id === "demand";
  const figureMeta = demand ? homepageDemandFigureInputs() : null;
  // `row-span-3` is not a definite line, so auto-placement puts the operators
  // in implicit columns. Each term owns an explicit track instead.
  const column = closed ? index * 2 + 1 : index + 1;

  return (
    <>
      {term.operator ? (
        <span
          data-operator
          className={`self-baseline mt-3 text-center leading-none font-light tabular-nums text-gray-900 ${DESK_FIGURE}`}
          style={{ gridColumn: column - 1, gridRow: 2 }}
          aria-hidden="true"
        >
          {term.operator}
        </span>
      ) : null}
      <div
        data-stat={term.id}
        data-geography={figureMeta?.geography_id}
        data-source={demand ? term.source : undefined}
        data-registry-unit={figureMeta?.unit}
        className="grid min-w-0 grid-rows-subgrid"
        style={{ gridColumn: column, gridRow: "1 / span 3" }}
      >
        <dt
          className={`row-start-1 self-end text-label-13 ${demand ? "font-semibold text-gray-1000" : "font-medium text-gray-900"}`}
          title={popoverText(term)}
        >
          {term.label}
        </dt>
        <dd
          data-figure
          className={`row-start-2 self-baseline mt-3 font-sans leading-none font-semibold tracking-[-0.04em] tabular-nums slashed-zero text-gray-1000 ${DESK_FIGURE}`}
          aria-describedby={demand ? PERIOD_ID : undefined}
        >
          <span data-value>{term.displayGw}</span>
          <span data-unit className={UNIT_CLASS}>
            {figureMeta?.displayUnit ?? "GW"}
          </span>
        </dd>
        <p
          data-caption
          className="row-start-3 self-start mt-2 max-w-[24ch] line-clamp-2 text-label-12 text-gray-900"
          title={term.role}
        >
          {term.role}
        </p>
      </div>
    </>
  );
}

function LedgerRow({ term }: { term: HeadlineTerm }) {
  const demand = term.id === "demand";
  const figureMeta = demand ? homepageDemandFigureInputs() : null;
  const figureSize = demand ? LEDGER_DEMAND_FIGURE : LEDGER_FIGURE;

  return (
    <>
      {demand ? <div className="col-span-3 border-t border-gray-alpha-400" /> : null}
      <span
        data-operator
        data-row={term.id}
        className={`min-h-11 text-center leading-[1.35] font-light tabular-nums text-gray-900 md:min-h-0 ${figureSize}`}
        aria-hidden="true"
      >
        {term.operator ?? "\u200b" /* keeps a baseline when Generation has no glyph */}
      </span>
      <span
        data-stat={term.id}
        data-row={term.id}
        data-label
        className={`min-h-11 min-w-0 self-baseline md:min-h-0 ${demand ? "text-copy-14 font-semibold text-gray-1000" : "text-copy-14 text-gray-900"}`}
        title={popoverText(term)}
      >
        <span data-label-text className="block">{term.label}</span>
        <span
          data-caption
          className="mt-0.5 hidden max-w-[24ch] text-label-12 text-gray-900 md:line-clamp-1"
          title={term.role}
        >
          {term.role}
        </span>
      </span>
      <span
        data-figure
        data-row={term.id}
        data-geography={figureMeta?.geography_id}
        data-source={demand ? term.source : undefined}
        data-registry-unit={figureMeta?.unit}
        className={`min-h-11 self-baseline whitespace-nowrap text-right font-sans leading-[1.35] font-semibold tracking-[-0.04em] tabular-nums slashed-zero text-gray-1000 md:min-h-0 ${figureSize}`}
      >
        <span data-value>{term.displayGw}</span>
        <span data-unit className={UNIT_CLASS}>
          {figureMeta?.displayUnit ?? "GW"}
        </span>
      </span>
    </>
  );
}

function popoverText(term: HeadlineTerm): string {
  return `${term.help} Source: ${term.source}.`;
}
