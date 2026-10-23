/**
 * One display rounding for every sum Grid prints.
 * Largest-remainder (Hamilton) gives the extra units to the biggest
 * fractional parts, so the rounded terms add up to the rounded total.
 * Terms are magnitudes with signs. The total is ordinary half-up rounding
 * (`toFixed`), and the terms move by at most one quantum to meet it.
 */

export type SignedDisplayPart = {
  value: number;
  sign: 1 | -1;
};

export function roundDisplay(value: number, quantum: number): number {
  return Number(value.toFixed(quantumDecimals(quantum)));
}

export function formatDisplay(value: number, quantum: number): string {
  const decimals = quantumDecimals(quantum);
  const text = value.toFixed(decimals);
  if (Number(text) === 0) {
    return (0).toFixed(decimals);
  }
  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;
  const [whole, fraction] = unsigned.split(".");
  const grouped = (whole ?? "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = fraction == null ? grouped : `${grouped}.${fraction}`;
  return negative ? `-${body}` : body;
}

/** Non-negative parts. The returned values sum to `roundDisplay` of their sum. */
export function largestRemainder(values: readonly number[], quantum: number): number[] {
  const sum = values.reduce((total, value) => total + Math.max(0, value), 0);
  return largestRemainderTo(values, quantum, roundDisplay(sum, quantum));
}

export function largestRemainderTo(
  values: readonly number[],
  quantum: number,
  target: number
): number[] {
  if (values.length === 0) {
    return [];
  }

  const decimals = quantumDecimals(quantum);
  const targetQuanta = quantaCount(target, quantum);
  const parts = values.map((value) => splitMagnitude(Math.max(0, value), quantum));
  const counts = parts.map((part) => part.floor);
  let remaining = targetQuanta - counts.reduce((total, count) => total + count, 0);
  const order = parts
    .map((part, index) => ({ index, frac: part.frac }))
    .sort((left, right) => right.frac - left.frac || left.index - right.index);

  let step = 0;
  const guard = Math.abs(remaining) + values.length * 4 + 2;
  while (remaining > 0 && step < guard) {
    const slot = order[step % order.length];
    if (!slot) {
      break;
    }
    counts[slot.index] += 1;
    remaining -= 1;
    step += 1;
  }
  while (remaining < 0 && step < guard) {
    const slot = order[(order.length - 1 - (step % order.length) + order.length) % order.length];
    if (!slot || counts[slot.index] <= 0) {
      step += 1;
      continue;
    }
    counts[slot.index] -= 1;
    remaining += 1;
    step += 1;
  }

  return counts.map((count) => fromQuanta(count, quantum, decimals));
}

/** Integer percents of one partition. They total 100 when the exact shares do. */
export function displayedPercents(exactPercents: readonly number[]): number[] {
  if (exactPercents.length === 0) {
    return [];
  }
  const sum = exactPercents.reduce((total, value) => total + value, 0);
  const target = Math.abs(sum - 100) <= 1e-4 ? 100 : roundDisplay(sum, 1);
  return largestRemainderTo(exactPercents, 1, target).map((value) => Math.round(value));
}

export function reconcileSignedDisplay(
  parts: readonly SignedDisplayPart[],
  total: number,
  quantum: number
): { parts: number[]; total: number } {
  const decimals = quantumDecimals(quantum);
  const normalized = parts.map((part) => normalizePart(part));
  const shownTotal = roundDisplay(total, quantum);
  const targetQuanta = quantaCount(shownTotal, quantum);
  const splits = normalized.map((part) => splitMagnitude(part.value, quantum));
  const counts = splits.map((part) => part.floor);
  const bumped = normalized.map(() => 0);

  const signed = () =>
    counts.reduce((sum, count, index) => sum + normalized[index]!.sign * count, 0);

  let delta = targetQuanta - signed();
  let guard = 0;
  const limit = Math.abs(delta) + normalized.length * 6 + 4;
  while (delta !== 0 && guard < limit && normalized.length > 0) {
    guard += 1;
    const wantIncrease = delta > 0;
    let best = -1;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < normalized.length; index += 1) {
      const part = normalized[index];
      const split = splits[index];
      if (!part || !split) {
        continue;
      }
      const helps = wantIncrease ? part.sign === 1 : part.sign === -1;
      if (!helps) {
        continue;
      }
      const score = split.frac - (bumped[index] ?? 0);
      if (score > bestScore + 1e-12 || (Math.abs(score - bestScore) <= 1e-12 && (best < 0 || index < best))) {
        best = index;
        bestScore = score;
      }
    }
    if (best < 0) {
      break;
    }
    counts[best] += 1;
    bumped[best] = (bumped[best] ?? 0) + 1;
    delta = targetQuanta - signed();
  }

  if (delta !== 0 && normalized.length > 0) {
    const direction: 1 | -1 = delta > 0 ? 1 : -1;
    const match = normalized.findIndex((part) => part.sign === direction);
    const index = match >= 0 ? match : 0;
    const part = normalized[index];
    if (part) {
      const adjustment = part.sign === direction ? Math.abs(delta) : -Math.abs(delta);
      counts[index] = Math.max(0, (counts[index] ?? 0) + adjustment);
    }
  }

  return {
    parts: counts.map((count) => fromQuanta(count, quantum, decimals)),
    total: shownTotal,
  };
}

function normalizePart(part: SignedDisplayPart): SignedDisplayPart {
  if (part.value < 0) {
    return { value: -part.value, sign: part.sign === 1 ? -1 : 1 };
  }
  return part;
}

function quantumDecimals(quantum: number): number {
  if (!(quantum > 0) || !Number.isFinite(quantum)) {
    throw new Error("Display quantum must be a positive finite number.");
  }
  const decimals = Math.round(-Math.log10(quantum));
  const rebuilt = 10 ** -decimals;
  if (decimals < 0 || decimals > 8 || Math.abs(rebuilt - quantum) > quantum * 1e-6) {
    throw new Error(`Display quantum must be a power of ten, received ${quantum}.`);
  }
  return decimals;
}

function quantaCount(value: number, quantum: number): number {
  const decimals = quantumDecimals(quantum);
  return Math.round(snap(value / quantum, decimals + 6));
}

function splitMagnitude(value: number, quantum: number): { floor: number; frac: number } {
  const decimals = quantumDecimals(quantum);
  const quanta = snap(Math.max(0, value) / quantum, decimals + 6);
  let floor = Math.floor(quanta + 1e-8);
  let frac = quanta - floor;
  if (frac >= 1 - 1e-8) {
    floor += 1;
    frac = 0;
  } else if (frac < 1e-8) {
    frac = 0;
  }
  return { floor, frac };
}

function fromQuanta(count: number, quantum: number, decimals: number): number {
  return Number((count * quantum).toFixed(decimals));
}

function snap(value: number, extra: number): number {
  return Number(value.toFixed(extra));
}
