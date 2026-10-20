export const MARKER_SHAPES = [
  "circle",
  "square",
  "triangle",
  "diamond",
  "hexagon",
  "plus",
  "ring",
  "triangle-down",
] as const;

export type MarkerShape = (typeof MARKER_SHAPES)[number];

export function isMarkerShape(value: string): value is MarkerShape {
  return (MARKER_SHAPES as readonly string[]).includes(value);
}

/** Three capacity steps. Radii are device pixels on the 2× static image. */
export const MAP_SIZE_STEPS = [
  { id: "s", label: "Under 50 MW", radius: 5 },
  { id: "m", label: "50–299 MW", radius: 9 },
  { id: "l", label: "300 MW and over", radius: 14 },
] as const;

export type MapSizeStep = (typeof MAP_SIZE_STEPS)[number];

/** A missing or negative megawatt figure is not a size. It is not "under 50 MW". */
export function mapSizeStep(mw: number | null): MapSizeStep | null {
  if (mw === null || !Number.isFinite(mw) || mw < 0) {
    return null;
  }
  if (mw < 50) {
    return MAP_SIZE_STEPS[0];
  }
  if (mw < 300) {
    return MAP_SIZE_STEPS[1];
  }
  return MAP_SIZE_STEPS[2];
}

type Point = readonly [number, number];

/** True when a pixel at (dx, dy) from the marker centre lies inside the shape. +y is down. */
export function markerCovers(shape: MarkerShape, dx: number, dy: number, radius: number, filled: boolean): boolean {
  if (radius < 0.5) {
    return Math.abs(dx) <= 0.5 && Math.abs(dy) <= 0.5;
  }
  const outer = shapeContains(shape, dx, dy, radius);
  if (!outer) {
    return false;
  }
  if (filled || shape === "ring") {
    return true;
  }
  const inset = Math.max(0.5, radius - 1.4);
  return !shapeContains(shape, dx, dy, inset);
}

function shapeContains(shape: MarkerShape, dx: number, dy: number, radius: number): boolean {
  switch (shape) {
    case "circle":
      return dx * dx + dy * dy <= radius * radius;
    case "ring": {
      const distance = dx * dx + dy * dy;
      return distance <= radius * radius && distance >= radius * radius * 0.28;
    }
    case "square":
      return Math.abs(dx) <= radius * 0.78 && Math.abs(dy) <= radius * 0.78;
    case "diamond":
      return Math.abs(dx) + Math.abs(dy) <= radius;
    case "plus":
      return (
        (Math.abs(dx) <= radius * 0.32 && Math.abs(dy) <= radius) ||
        (Math.abs(dy) <= radius * 0.32 && Math.abs(dx) <= radius)
      );
    case "triangle":
      return pointInPolygon(dx, dy, [
        [0, -radius],
        [-radius * 0.92, radius * 0.78],
        [radius * 0.92, radius * 0.78],
      ]);
    case "triangle-down":
      return pointInPolygon(dx, dy, [
        [0, radius],
        [-radius * 0.92, -radius * 0.78],
        [radius * 0.92, -radius * 0.78],
      ]);
    case "hexagon":
      return pointInPolygon(dx, dy, hexagon(radius));
    default: {
      const neverShape: never = shape;
      return neverShape;
    }
  }
}

function hexagon(radius: number): Point[] {
  const points: Point[] = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = (Math.PI / 3) * index - Math.PI / 2;
    points.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  return points;
}

function pointInPolygon(x: number, y: number, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const start = polygon[previous];
    const end = polygon[index];
    if (!start || !end) {
      continue;
    }
    const crosses = start[1] > y !== end[1] > y;
    if (!crosses) {
      continue;
    }
    const xCross = ((end[0] - start[0]) * (y - start[1])) / (end[1] - start[1]) + start[0];
    if (x < xCross) {
      inside = !inside;
    }
  }
  return inside;
}
