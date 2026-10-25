import { readFileSync } from "node:fs";
import { join } from "node:path";
import { API_KEY_ABSENT_REASON, UNLICENSED_REASON } from "@/lib/power-cuts/copy";
import { parseNged, parseNpg, parseUkpn } from "@/lib/power-cuts/parse";
import type { PowerCutsSnapshot, SourceReport } from "@/lib/power-cuts/schema";

const FETCHED_AT = "2026-10-25T19:10:00.000Z";

function read(cwd: string, name: string): string {
  return readFileSync(join(cwd, "tests/fixtures/power-cuts", name), "utf8");
}

function report(status: SourceReport["status"], count: number, error?: string): SourceReport {
  if (status === "ok") {
    return { status, fetchedAt: FETCHED_AT, count };
  }
  return { status, fetchedAt: null, count: 0, ...(error ? { error } : {}) };
}

/** Page fixture when Blob is unset. Enabled operators are the trimmed live samples. */
export function buildFixtureSnapshot(cwd = process.cwd()): PowerCutsSnapshot {
  const incidents = [
    ...parseUkpn(JSON.parse(read(cwd, "ukpn.json"))),
    ...parseNged(read(cwd, "nged.csv")),
    ...parseNpg(JSON.parse(read(cwd, "npg.json"))),
  ];
  const counts = {
    ukpn: incidents.filter((incident) => incident.operator === "ukpn").length,
    nged: incidents.filter((incident) => incident.operator === "nged").length,
    npg: incidents.filter((incident) => incident.operator === "npg").length,
  };
  return {
    fetchedAt: FETCHED_AT,
    sources: {
      ukpn: report("ok", counts.ukpn),
      ssen: report("unlicensed", 0, UNLICENSED_REASON),
      nged: report("ok", counts.nged),
      npg: report("ok", counts.npg),
      enw: report("absent", 0, API_KEY_ABSENT_REASON),
      spen: report("absent", 0, API_KEY_ABSENT_REASON),
      nie: report("unlicensed", 0, UNLICENSED_REASON),
    },
    incidents,
  };
}
