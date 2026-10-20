/** Discrete dash phases. A unique array every frame fills the line atlas, and the next lookup is null. */
export const CHEVRON_STEPS = 12;

export function chevronDash(step: number): [number, number, number, number] {
  const span = 4;
  const wrapped = ((step % CHEVRON_STEPS) + CHEVRON_STEPS) % CHEVRON_STEPS;
  const offset = (wrapped / CHEVRON_STEPS) * span;
  const lead = Math.max(0.25, offset);
  const tail = Math.max(0.25, span - offset);
  return [lead, 2, tail, 0.25];
}
