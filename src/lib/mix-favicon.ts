import { FUEL_COLORS, carbonIndexColor } from "@/lib/colors";
import type { EnergySnapshot } from "@/lib/types";

export const MIX_FAVICON_FUELS = [
  "gas",
  "coal",
  "nuclear",
  "wind",
  "solar",
  "hydro",
  "biomass",
  "imports",
  "other",
] as const;

export type MixFaviconSegment = {
  fuel: string;
  pct: number;
  color: string;
};

export function mixSegmentsFromSnapshot(snapshot: EnergySnapshot | null): MixFaviconSegment[] {
  if (!snapshot) {
    return [];
  }

  const segments: MixFaviconSegment[] = [];
  for (const fuel of MIX_FAVICON_FUELS) {
    const pct = mixPct(snapshot, fuel);
    if (pct == null || pct <= 0) {
      continue;
    }
    segments.push({
      fuel,
      pct,
      color: FUEL_COLORS[fuel] ?? "#9ca3af",
    });
  }
  return segments;
}

function mixPct(
  snapshot: EnergySnapshot,
  fuel: (typeof MIX_FAVICON_FUELS)[number]
): number | null {
  switch (fuel) {
    case "gas":
      return snapshot.gen_gas_pct;
    case "coal":
      return snapshot.gen_coal_pct;
    case "nuclear":
      return snapshot.gen_nuclear_pct;
    case "wind":
      return snapshot.gen_wind_pct;
    case "solar":
      return snapshot.gen_solar_pct;
    case "hydro":
      return snapshot.gen_hydro_pct;
    case "biomass":
      return snapshot.gen_biomass_pct;
    case "imports":
      return snapshot.gen_imports_pct;
    case "other":
      return snapshot.gen_other_pct;
    default: {
      const exhaustive: never = fuel;
      return exhaustive;
    }
  }
}

export function renderMixFaviconSvg(snapshot: EnergySnapshot | null): string {
  const segments = mixSegmentsFromSnapshot(snapshot);
  const center = carbonIndexColor(snapshot?.carbon_index ?? "");
  const slices = pieSlices(segments);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">`,
    `<title>Current GB generation mix</title>`,
    `<circle cx="16" cy="16" r="15" fill="${escapeXml(center)}"/>`,
    ...slices.map(
      (slice) =>
        `<path d="${slice.d}" fill="${escapeXml(slice.color)}" stroke="#0a0a0a" stroke-width="0.6"/>`
    ),
    `<circle cx="16" cy="16" r="6" fill="${escapeXml(center)}"/>`,
    `</svg>`,
  ].join("");
}

function pieSlices(segments: MixFaviconSegment[]): Array<{ d: string; color: string }> {
  const total = segments.reduce((sum, segment) => sum + segment.pct, 0);
  if (total <= 0) {
    return [];
  }

  const slices: Array<{ d: string; color: string }> = [];
  let angle = -Math.PI / 2;
  for (const segment of segments) {
    const sweep = (segment.pct / total) * Math.PI * 2;
    // A single 2π arc starts and ends on the same point, so SVG draws nothing.
    if (sweep >= Math.PI * 2 - 1e-9) {
      slices.push(
        { d: donutSlice(16, 16, 15, 7, angle, angle + Math.PI), color: segment.color },
        {
          d: donutSlice(16, 16, 15, 7, angle + Math.PI, angle + Math.PI * 2),
          color: segment.color,
        }
      );
    } else {
      slices.push({ d: donutSlice(16, 16, 15, 7, angle, angle + sweep), color: segment.color });
    }
    angle += sweep;
  }
  return slices;
}

function donutSlice(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  start: number,
  end: number
): string {
  const large = end - start > Math.PI ? 1 : 0;
  const outerStart = pointOnCircle(cx, cy, outer, start);
  const outerEnd = pointOnCircle(cx, cy, outer, end);
  const innerStart = pointOnCircle(cx, cy, inner, end);
  const innerEnd = pointOnCircle(cx, cy, inner, start);
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outer} ${outer} 0 ${large} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${inner} ${inner} 0 ${large} 0 ${innerEnd.x} ${innerEnd.y}`,
    "Z",
  ].join(" ");
}

function pointOnCircle(cx: number, cy: number, radius: number, angle: number): {
  x: string;
  y: string;
} {
  return {
    x: (cx + radius * Math.cos(angle)).toFixed(3),
    y: (cy + radius * Math.sin(angle)).toFixed(3),
  };
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}
