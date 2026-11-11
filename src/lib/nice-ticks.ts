const STEP_BASES = [1, 2, 2.5, 5, 10] as const;

function stepFor(span: number, target: number): number {
  const rough = span / Math.max(target - 1, 1);
  const exponent = Math.floor(Math.log10(Math.max(rough, Number.MIN_VALUE)));
  const magnitude = 10 ** exponent;
  const residual = rough / magnitude;
  let base: number = 10;
  for (const candidate of STEP_BASES) {
    if (residual <= candidate + 1e-9) {
      base = candidate;
      break;
    }
  }
  return base * magnitude;
}

/** Smallest magnitude in the 1/2/2.5/5 series that covers `value`. */
export function niceMagnitude(value: number): number {
  const abs = Math.abs(value);
  if (abs === 0) {
    return 0;
  }
  const exponent = Math.floor(Math.log10(abs));
  const magnitude = 10 ** exponent;
  for (const base of STEP_BASES) {
    const candidate = base * magnitude;
    if (candidate >= abs * (1 - 1e-9)) {
      return candidate;
    }
  }
  return 10 * magnitude;
}

function snap(value: number, step: number): number {
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Nice axis ticks. Steps are {1, 2, 2.5, 5}×10ⁿ.
 * The domain includes 0 when the series crosses it or sits entirely on one side.
 * A near-zero side is not padded out to a full coarse step.
 */
export function niceTicks(min: number, max: number, options?: { target?: number }): number[] {
  const target = options?.target ?? 5;
  let lo = Math.min(min, max);
  let hi = Math.max(min, max);
  if (lo > 0) {
    lo = 0;
  }
  if (hi < 0) {
    hi = 0;
  }
  if (lo === 0 && hi === 0) {
    return [0, 1];
  }
  const step = stepFor(Math.max(hi - lo, Number.MIN_VALUE), target);
  let start = snap(Math.floor(lo / step) * step, step);
  let end = snap(Math.ceil(hi / step) * step, step);
  if (lo < 0 && start < lo && Math.abs(lo) < step && lo - start > step * 0.75) {
    start = snap(-niceMagnitude(Math.abs(lo)), step);
  }
  if (hi > 0 && end > hi && hi < step && end - hi > step * 0.75) {
    end = snap(niceMagnitude(hi), step);
  }
  const ticks: number[] = [];
  if (start < 0) {
    ticks.push(start);
  }
  const origin = 0;
  const last = Math.max(end, origin);
  const count = Math.round((last - origin) / step);
  for (let index = 0; index <= count; index += 1) {
    ticks.push(snap(origin + index * step, step));
  }
  if (start < -step * 1.25) {
    const spanned: number[] = [];
    const steps = Math.round((0 - start) / step);
    for (let index = steps; index >= 1; index -= 1) {
      spanned.push(snap(origin - index * step, step));
    }
    return uniqueSorted([...spanned, ...ticks]);
  }
  return uniqueSorted(ticks);
}

function uniqueSorted(values: number[]): number[] {
  const seen = new Set<number>();
  const ticks: number[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    ticks.push(value);
  }
  ticks.sort((left, right) => left - right);
  return ticks;
}
