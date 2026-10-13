import { fuelLabel } from "@/lib/colors";
import { normalizeFuelType } from "@/lib/dashboard-model";
import { formatHeadlineGw } from "@/lib/facts";

export type AnswerHorizon = "live" | "year" | "all";

export type AnswerSentenceInput = {
  topFuel: string | null;
  topMw: number | null;
  topSharePct?: number | null;
  transfersMw: number | null;
  empty: boolean;
  horizon?: AnswerHorizon;
};

const TRANSFER_BALANCE_MW = 25;
const MAJORITY_SHARE_PCT = 50;

export function buildAnswerSentence(input: AnswerSentenceInput): string {
  if (input.empty) {
    return "Britain’s electricity picture is still catching up.";
  }

  const lead = leadClause(input);
  const magnitude = magnitudeClause(input);
  if (input.horizon !== "year" && input.horizon !== "all") {
    return `${lead}${magnitude}.`;
  }

  const transfer = transferClause(input);
  if (!transfer) {
    return `${lead}${magnitude}.`;
  }

  return `${lead}${magnitude}, ${transfer}`;
}

function magnitudeClause(input: AnswerSentenceInput): string {
  if (input.topMw == null || input.topSharePct == null) {
    return "";
  }
  return ` at ${formatHeadlineGw(input.topMw)} GW (${Math.round(input.topSharePct)}%)`;
}

function leadClause(input: AnswerSentenceInput): string {
  if (!input.topFuel || input.topMw == null) {
    return input.horizon === "year" || input.horizon === "all"
      ? "Britain’s longer-run electricity mix is still settling"
      : "Britain’s electricity mix is still settling";
  }

  const name = fuelLabel(normalizeFuelType(input.topFuel));
  const majority = input.topSharePct != null && input.topSharePct >= MAJORITY_SHARE_PCT;
  if (input.horizon === "year") {
    return majority
      ? `Over the past year, ${name.toLowerCase()} has supplied most of Britain’s electricity`
      : `Over the past year, ${name.toLowerCase()} has been the largest source of Britain’s electricity`;
  }
  if (input.horizon === "all") {
    return majority
      ? `Since 2009, ${name.toLowerCase()} has supplied most of Britain’s electricity`
      : `Since 2009, ${name.toLowerCase()} has been the largest source of Britain’s electricity`;
  }
  if (majority) {
    return `${name} is supplying most of Britain’s electricity`;
  }
  return `${name} is the largest source of Britain’s electricity`;
}

function transferClause(input: AnswerSentenceInput): string | null {
  if (input.transfersMw == null) {
    return null;
  }

  if (Math.abs(input.transfersMw) < TRANSFER_BALANCE_MW) {
    return "with cross-border flows broadly balanced.";
  }

  if (input.horizon === "year" || input.horizon === "all") {
    if (input.transfersMw > 0) {
      return `and imports have averaged ${formatHeadlineGw(input.transfersMw)} GW.`;
    }
    return `and exports have averaged ${formatHeadlineGw(Math.abs(input.transfersMw))} GW.`;
  }

  if (input.transfersMw > 0) {
    return `and the country is importing ${formatHeadlineGw(input.transfersMw)} GW.`;
  }

  return `and the country is exporting ${formatHeadlineGw(Math.abs(input.transfersMw))} GW.`;
}
