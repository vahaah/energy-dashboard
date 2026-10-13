import { InfoTooltip } from "@/components/ui/info-tooltip";
import { formatHeadlineGw } from "@/lib/facts";
import { formatPlainSettlementWindow } from "@/lib/generation-desk-view";
import type { DisplayedPower, HeadlineTerm } from "@/lib/displayed-demand";

export function EquationRow({ power }: { power: DisplayedPower }) {
  const datetime = power.generationStartUtc ?? power.demandStartUtc;
  const timeLabel = datetime ? formatPlainSettlementWindow(datetime) : null;

  return (
    <div>
      <div
        data-balanced={power.showEquals ? "true" : "false"}
        className="flex flex-wrap items-start gap-x-1 gap-y-4 sm:gap-x-2"
        role="group"
        aria-label={equationAria(power.terms, power.showEquals)}
      >
        {power.terms.map((term) => (
          <EquationTerm key={term.id} term={term} />
        ))}
      </div>
      {datetime && timeLabel ? (
        <p className="mt-2 text-label-12 text-gray-900">
          <time className="text-mono-12" dateTime={datetime}>
            {timeLabel}
          </time>
        </p>
      ) : null}
    </div>
  );
}

function EquationTerm({ term }: { term: HeadlineTerm }) {
  return (
    <div data-stat={term.id} className="grid min-w-[6.5rem] grid-cols-[auto_minmax(6.5rem,1fr)] sm:min-w-[7.5rem]">
      <div className="col-start-2 row-start-1 flex items-center gap-1">
        <p className="text-label-13 text-gray-900">{term.label}</p>
        <InfoTooltip text={term.help} label={`What is ${term.label}?`} />
      </div>
      {term.operator ? (
        <span
          className="col-start-1 row-start-2 flex w-6 items-center justify-center self-center text-xl font-light text-gray-700 sm:w-8 sm:text-4xl"
          aria-hidden="true"
        >
          {term.operator}
        </span>
      ) : null}
      <p className="col-start-2 row-start-2 font-sans text-[1.75rem] leading-9 font-semibold tracking-[-0.04em] tabular-nums text-gray-1000 sm:text-display sm:leading-[3.25rem]">
        <span>{formatHeadlineGw(displayMw(term))}</span>
        <span className="text-gray-700">GW</span>
      </p>
      <p className="col-start-2 row-start-3 hidden max-w-36 text-pretty text-label-12 text-gray-900 sm:block">
        <span data-source={term.source}>{term.source}</span>
      </p>
    </div>
  );
}

function displayMw(term: HeadlineTerm): number | null {
  if (term.mw == null) {
    return null;
  }
  if (term.operator === "+" || term.operator === "−") {
    return Math.abs(term.mw);
  }
  return term.mw;
}

function equationAria(terms: HeadlineTerm[], showEquals: boolean): string {
  const parts = terms.map((term) => {
    const value = `${formatHeadlineGw(displayMw(term))} GW`;
    switch (term.operator) {
      case "+":
        return `plus ${term.label} ${value}`;
      case "−":
        return `minus ${term.label} ${value}`;
      case "=":
        return `equals ${term.label} ${value}`;
      case null:
        return `${term.label} ${value}`;
      default: {
        const exhaustive: never = term.operator;
        return exhaustive;
      }
    }
  });
  if (!showEquals) {
    return `${parts.join(", ")}. Not a closed equation.`;
  }
  return parts.join(", ");
}
