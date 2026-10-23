import { formatGrouped } from "@/lib/format/quantity";
import type { PipelineFigures } from "@/lib/pipeline/model";

export type PipelineFaq = { question: string; answer: string };

export function pipelineFaqs(figures: PipelineFigures, edition: string): PipelineFaq[] {
  const battery = figures.technologies.find((row) => row.technology === "battery");
  const planning = figures.medians.find((step) => step.id === "in_planning");
  const operating = figures.cohort.outcomes.find((outcome) => outcome.id === "operating");
  const refused = figures.cohort.outcomes.find((outcome) => outcome.id === "refused");
  const batteryAnswer = battery
    ? `${formatGrouped(battery.projects, 0)} projects, ${battery.amount}, ${edition}.`
    : `${edition} does not list a battery total.`;
  const medianAnswer =
    planning?.days != null
      ? `Median ${formatGrouped(planning.days, 0)} days in planning, counting only projects that finished this step.`
      : "A planning median is not published for this edition.";
  const cohortAnswer =
    operating && refused
      ? `${operating.percent}% are operating and ${refused.percent}% were refused. Consent does not mean a project will be built.`
      : "The 2015–2020 table lists each outcome. Consent does not mean a project will be built.";

  return [
    {
      question: "How many battery projects are in the pipeline?",
      answer: batteryAnswer,
    },
    {
      question: "How long do projects spend in planning?",
      answer: medianAnswer,
    },
    {
      question: "What happened to projects submitted 2015–2020?",
      answer: cohortAnswer,
    },
    {
      question: "Does consent mean a project will be built?",
      answer: "No. Consent does not mean a project will be built. The 2015–2020 outcome table shows what happened next.",
    },
  ];
}
