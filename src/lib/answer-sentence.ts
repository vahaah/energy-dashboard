import { fuelLabel } from "@/lib/colors";
import { normalizeFuelType } from "@/lib/dashboard-model";
import { formatHeadlineGw } from "@/lib/facts";

export type AnswerSentenceInput = {
  topFuel: string | null;
  topMw: number | null;
  transfersMw: number | null;
  empty: boolean;
};

const TRANSFER_BALANCE_MW = 25;

export function buildAnswerSentence(input: AnswerSentenceInput): string {
  if (input.empty) {
    return "Britain’s electricity picture is still catching up.";
  }

  const lead =
    input.topFuel && input.topMw != null
      ? `${fuelLabel(normalizeFuelType(input.topFuel))} is supplying most of Britain’s electricity`
      : "Britain’s electricity mix is still settling";

  if (input.transfersMw == null) {
    return `${lead}.`;
  }

  if (Math.abs(input.transfersMw) < TRANSFER_BALANCE_MW) {
    return `${lead}, with cross-border flows broadly balanced.`;
  }

  if (input.transfersMw > 0) {
    return `${lead}, and the country is importing ${formatHeadlineGw(input.transfersMw)} GW.`;
  }

  return `${lead}, and the country is exporting ${formatHeadlineGw(Math.abs(input.transfersMw))} GW.`;
}
