import { ABSENT_FIGURE } from "@/lib/data-state";
import type { GasDocument, GasShareRow, GasSlice } from "@/lib/gas/view";
import { selectGasSlice } from "@/lib/gas/view";

export type GasFaq = { question: string; answer: string };

function published(value: string | null | undefined): string | null {
  if (!value || value === ABSENT_FIGURE || value === "Not available") {
    return null;
  }
  return value;
}

function shareSentence(rows: readonly GasShareRow[], label: string): string | null {
  const row = rows.find((item) => item.label === label);
  const value = published(row?.valueLabel);
  if (!row || !value) {
    return null;
  }
  return `${label} ${value} ${row.unit} (${row.percent}%)`;
}

function entryAnswer(slice: GasSlice): string {
  const ranked = [...slice.entry].filter((row) => published(row.valueLabel));
  const top = ranked[0];
  const north = slice.entry.find((row) => /north/i.test(row.label));
  const south = slice.entry.find((row) => /south/i.test(row.label));
  const parts = [`Entry on gas day ${slice.dayLabel}`];
  if (top) {
    parts.push(`${top.label} ${top.valueLabel} ${top.unit}`);
  }
  if (north && south && published(north.valueLabel) && published(south.valueLabel)) {
    parts.push(`North ${north.percent}%, South ${south.percent}%`);
  }
  parts.push("The map shows each terminal.");
  return `${parts.join(". ")}.`;
}

function powerAnswer(slice: GasSlice): string {
  const power = shareSentence(slice.demand, "Power stations");
  if (!power) {
    return `Power-station demand is not published for gas day ${slice.dayLabel}. Gas's share of electricity is on the today page.`;
  }
  return `${power} of NTS demand on gas day ${slice.dayLabel}. Gas's share of electricity is on the today page.`;
}

function linepackAnswer(slice: GasSlice): string {
  const opening = published(slice.linepack.opening);
  const close = published(slice.linepack.predictedClose);
  const held = "Linepack is gas held in the pipelines.";
  if (opening && close) {
    return `${held} Opening ${opening} ${slice.linepack.unit}, predicted close ${close} ${slice.linepack.unit}.`;
  }
  return held;
}

function staticFaqs(): GasFaq[] {
  return [
    {
      question: "What is linepack?",
      answer: "Linepack is gas held in the pipelines.",
    },
    {
      question: "What is a gas day?",
      answer: "A gas day runs from 05:00 to 05:00 UK time. Figures before 05:00 the next day are partial.",
    },
  ];
}

export function gasSystemFaqs(document: GasDocument): GasFaq[] {
  if (!document.available) {
    return staticFaqs();
  }
  const slice = selectGasSlice(document, null, null);
  return [
    {
      question: "Where does Britain's gas come from?",
      answer: entryAnswer(slice),
    },
    {
      question: "How much gas do power stations use?",
      answer: powerAnswer(slice),
    },
    {
      question: "What is linepack?",
      answer: linepackAnswer(slice),
    },
    {
      question: "What is a gas day?",
      answer: "A gas day runs from 05:00 to 05:00 UK time. Figures before 05:00 the next day are partial.",
    },
  ];
}
