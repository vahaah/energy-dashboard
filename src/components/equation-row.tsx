import { InfoTooltip } from "@/components/ui/info-tooltip";
import { CARD_PAD_X } from "@/components/ui/card";
import { balanceEquationSentence, type DisplayedPower, type HeadlineTerm } from "@/lib/displayed-demand";
import { formatHeadlineGw } from "@/lib/facts";

const PERIOD_ID = "balance-period";

export function EquationRow({ power }: { power: DisplayedPower }) {
  const sentence = balanceEquationSentence(power);
  const wideFigures = power.terms.length >= 5;

  return (
    <div data-slot="card-pad" className={CARD_PAD_X}>
      <p className="sr-only">{sentence}</p>
      <dl
        data-balanced={power.balanceClosed ? "true" : "false"}
        aria-hidden="true"
        className={equationGridClass(power.balanceClosed, wideFigures)}
      >
        {power.terms.map((term) => (
          <EquationTerm key={term.id} term={term} wide={wideFigures} />
        ))}
      </dl>
      <div className="lg:hidden" aria-hidden="true">
        {power.terms.map((term) => (
          <LedgerRow key={term.id} term={term} />
        ))}
      </div>
    </div>
  );
}

function equationGridClass(closed: boolean, wide: boolean): string {
  const base = "hidden items-end gap-x-0 pt-8 pb-7 lg:grid";
  if (!closed) {
    return `${base} grid-cols-3`;
  }
  if (wide) {
    return `${base} grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)_2.5rem_minmax(0,1fr)_2.5rem_minmax(0,1fr)_2.5rem_minmax(0,1fr)]`;
  }
  return `${base} grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)_2.5rem_minmax(0,1fr)_2.5rem_minmax(0,1fr)]`;
}

export function balancePeriodId(): string {
  return PERIOD_ID;
}

function EquationTerm({ term, wide }: { term: HeadlineTerm; wide: boolean }) {
  const demand = term.id === "demand";
  const figure =
    wide
      ? "text-[2.5rem] @min-[1102px]:text-[3rem]"
      : "text-[2.5rem] @min-[1100px]:text-[3rem]";

  return (
    <>
      {term.operator ? (
        <span
          className="self-end pb-[0.35rem] text-center text-[2rem] font-normal text-gray-700"
          aria-hidden="true"
        >
          {term.operator}
        </span>
      ) : null}
      <div data-stat={term.id} className={demand ? "min-w-0 border-l border-gray-alpha-400 pl-6" : "min-w-0"}>
        <dt className="flex items-center gap-1 text-label-13 font-medium text-gray-900">
          <span>{term.label}</span>
          <InfoTooltip text={popoverText(term)} label={`What is ${term.label}?`} />
        </dt>
        <dd
          data-figure
          className={`mt-3 font-sans leading-tight font-semibold tracking-[-0.04em] tabular-nums slashed-zero text-gray-1000 ${figure}`}
          title={term.roundingNote ?? undefined}
          aria-describedby={demand ? PERIOD_ID : undefined}
        >
          <span data-value>{formatHeadlineGw(unsignedMw(term.mw))}</span>
          <span data-unit className="ml-1 align-baseline text-xl font-medium tracking-normal text-gray-700">
            GW
          </span>
        </dd>
        <p className="mt-2 truncate text-label-12 text-gray-900">{term.role}</p>
      </div>
    </>
  );
}

function LedgerRow({ term }: { term: HeadlineTerm }) {
  const demand = term.id === "demand";
  const generation = term.id === "generation";
  const figure = demand || generation ? "text-[2rem]" : "text-2xl";

  return (
    <div
      data-stat={term.id}
      className={`grid grid-cols-[1.25rem_1fr_auto] items-baseline py-1.5 ${
        demand ? "mt-1.5 border-t border-gray-700 pt-3" : ""
      }`}
    >
      <span className="text-xl font-normal text-gray-700" aria-hidden="true">
        {term.operator ?? ""}
      </span>
      <span className={`flex items-center gap-1 text-label-13 font-medium ${demand ? "text-gray-1000" : "text-gray-900"}`}>
        <span>{term.label}</span>
        <InfoTooltip text={popoverText(term)} label={`What is ${term.label}?`} />
      </span>
      <span
        data-figure
        className={`font-sans leading-tight font-semibold tracking-[-0.04em] tabular-nums slashed-zero text-gray-1000 ${figure}`}
      >
        <span data-value>{formatHeadlineGw(unsignedMw(term.mw))}</span>
        <span data-unit className="ml-1 align-baseline text-sm font-medium tracking-normal text-gray-700">
          GW
        </span>
      </span>
    </div>
  );
}

function popoverText(term: HeadlineTerm): string {
  return `${term.help} Source: ${term.source}.`;
}

function unsignedMw(mw: number | null): number | null {
  if (mw == null) {
    return null;
  }
  return Math.abs(mw);
}
