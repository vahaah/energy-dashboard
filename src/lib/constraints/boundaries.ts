/**
 * Constraint groups in the day-ahead file on 15 Oct 2026.
 * A group that is not in this list quarantines the file. Add it here before
 * the next publish, or the previous pointer stays.
 */
export const CONSTRAINT_BOUNDARIES = [
  "BOLSELEX",
  "BOLSELEX1",
  "CANDUNEX",
  "CANSELEX",
  "DRESHEX1",
  "DUNSELEX",
  "ERROEX",
  "ESTEX",
  "ESTEX3",
  "ESTEX4",
  "FLOWSTH",
  "GALLEX",
  "GETEX",
  "GM_SNOW5A",
  "HARSPNBLY",
  "NINSELEX",
  "NKILGRMO",
  "SCOTEX",
  "SEIMP",
  "SEIMPPR21",
  "SEIMPPR23",
  "SEIMPPR33",
  "SHARN",
  "SSEN_S",
  "SSE_GRMO",
  "SSE_SP",
  "SSE_SP2",
  "SSHARN",
  "SSHARN3",
  "SSHARN7",
  "SWALEX",
] as const;

export type ConstraintBoundary = (typeof CONSTRAINT_BOUNDARIES)[number];

const BOUNDARY_SET = new Set<string>(CONSTRAINT_BOUNDARIES);

export function isConstraintBoundary(value: string): value is ConstraintBoundary {
  return BOUNDARY_SET.has(value);
}

export const DAY_AHEAD_HEADER = ["Constraint Group", "Date_ Time GMT_BST", "Limit_MW", "Flow_MW"] as const;

/** Half-hours kept on the release. The raw CSV stays addressed by its hash. */
export const DAY_AHEAD_RETAINED_DATES = 16;
