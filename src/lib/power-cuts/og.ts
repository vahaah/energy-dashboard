import { formatGrouped } from "@/lib/format/quantity";
import { gridEyebrow, type OgCard } from "@/lib/og/model";
import { buildPowerCutsModel } from "@/lib/power-cuts/model";
import type { PowerCutsSnapshot } from "@/lib/power-cuts/schema";

/** Card copy stays free of live / real-time / right now / UK. The page title carries those words. */
export function buildPowerCutsOgCard(snapshot: PowerCutsSnapshot | null, now = new Date()): OgCard {
  if (!snapshot) {
    return {
      eyebrow: gridEyebrow("Power cuts"),
      title: "Power cuts by area",
      kicker: "Not yet available",
      metrics: [],
      mix: [],
      stamp: null,
      source: "UKPN, Northern Powergrid, NGED",
      cached: false,
    };
  }
  const model = buildPowerCutsModel(snapshot, now);
  return {
    eyebrow: gridEyebrow("Power cuts"),
    title: "Power cuts by area",
    kicker: "Incidents by network operator, updated every 15 minutes.",
    metrics: [
      { label: "Incidents", value: formatGrouped(model.incidents, 0) },
      {
        label: "Customers off",
        value: model.customersOff == null ? "—" : formatGrouped(model.customersOff, 0),
      },
      { label: "Operators", value: `${model.operatorsReporting}/${model.operatorTotal}` },
    ],
    mix: [],
    stamp: model.asOf,
    source: "UKPN, Northern Powergrid, NGED",
    cached: false,
  };
}
