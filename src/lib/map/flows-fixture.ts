import type { CapacityRelease } from "@/lib/map/capacity";
import type { ElectricityFlowsRelease } from "@/lib/map/electricity-release";
import { SPARK_HOURS, SPARK_STEP_MINUTES } from "@/lib/map/electricity-release";
import type { GasTerminalFlowsRelease } from "@/lib/map/gas-terminal-flows";

/**
 * Used only when `BLOB_READ_WRITE_TOKEN` is unset (tests, CI, local).
 * Capacity figures are the NESO Interconnector Register Built rows observed
 * on 20 Oct 2026. One electricity code and one terminal are left out so a
 * missing reading stays —.
 */
const FIXTURE_MW: Record<string, number> = {
  INTFR: 1200,
  INTIFA2: -400,
  INTELEC: 800,
  INTNED: 200,
  INTNEM: -1500,
  INTNSL: 600,
  INTVKL: 50,
  INTIRL: -100,
  INTEW: 300,
};

const FIXTURE_CAPACITY: { code: string; importMw: number; exportMw: number; projectName: string; connectionSite: string }[] = [
  { code: "INTFR", importMw: 1988, exportMw: 1988, projectName: "IFA Interconnector", connectionSite: "Sellindge 400kV Substation" },
  { code: "INTIFA2", importMw: 1100, exportMw: 1150, projectName: "IFA2 Interconnector", connectionSite: "Chilling 400kV Substation" },
  { code: "INTELEC", importMw: 1000, exportMw: 1050, projectName: "ElecLink", connectionSite: "Sellindge 400kV Substation" },
  { code: "INTNED", importMw: 1200, exportMw: 1200, projectName: "Britned", connectionSite: "Grain 400kV Substation" },
  { code: "INTNEM", importMw: 1020, exportMw: 1046, projectName: "Nemo Link", connectionSite: "Richborough 400kV Substation" },
  { code: "INTNSL", importMw: 1400, exportMw: 1480, projectName: "NS Link", connectionSite: "Blyth GSP" },
  { code: "INTVKL", importMw: 1500, exportMw: 1500, projectName: "Viking Link Denmark Interconnector", connectionSite: "Bicker Fen 400kV Substation" },
  { code: "INTIRL", importMw: 475, exportMw: 500, projectName: "Auchencrosh (interconnector CCT)", connectionSite: "Auchencrosh 275kV" },
  { code: "INTEW", importMw: 505, exportMw: 585, projectName: "East West Interconnector", connectionSite: "Deeside 400kV Substation" },
  { code: "INTGRNL", importMw: 504, exportMw: 524, projectName: "Greenlink", connectionSite: "Pembroke 400kV Substation" },
];

const FIXTURE_GAS: { key: string; role: "entry" | "exit"; mcmPerDay: number }[] = [
  { key: "bacton-ips", role: "entry", mcmPerDay: 0 },
  { key: "bacton-ukcs", role: "entry", mcmPerDay: 12 },
  { key: "barrow", role: "entry", mcmPerDay: 4 },
  { key: "easington", role: "entry", mcmPerDay: 75 },
  { key: "isle-of-grain", role: "entry", mcmPerDay: 3.4 },
  { key: "milford-haven", role: "entry", mcmPerDay: 5 },
  { key: "st-fergus", role: "entry", mcmPerDay: 47 },
  { key: "teesside", role: "entry", mcmPerDay: 21 },
  { key: "moffat", role: "exit", mcmPerDay: 13 },
];

export function fixtureMapFlows(now: Date): {
  electricity: ElectricityFlowsRelease;
  gas: GasTerminalFlowsRelease;
  capacity: CapacityRelease;
} {
  const at = now.toISOString();
  const origin = now.getTime() - (SPARK_HOURS - 1) * SPARK_STEP_MINUTES * 60 * 1000;
  return {
    electricity: {
      generated_at: at,
      series: Object.entries(FIXTURE_MW).map(([code, latestMw]) => ({
        code,
        latestMw,
        latestAt: at,
        spark: {
          start: new Date(origin).toISOString(),
          stepMinutes: SPARK_STEP_MINUTES,
          values: Array.from({ length: SPARK_HOURS }, (_, index) => (index % 5 === 0 ? null : latestMw)),
        },
      })),
    },
    gas: {
      generated_at: at,
      published_at: at,
      samples: FIXTURE_GAS.map((sample) => ({ ...sample, at })),
      history: Object.fromEntries(
        FIXTURE_GAS.map((sample) => [sample.key, [{ ...sample, at }]]),
      ),
    },
    capacity: {
      generated_at: at,
      published_at: at,
      rows: FIXTURE_CAPACITY.map((row) => ({ ...row })),
    },
  };
}
