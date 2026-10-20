/** SVG path that starts a new subpath after each null sample. */
export function sparklinePath(
  values: readonly (number | null)[],
  width: number,
  height: number,
): string | null {
  const finite = values.filter((value): value is number => value !== null);
  if (finite.length === 0) {
    return null;
  }
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = max - min || 1;
  let path = "";
  let drawing = false;
  values.forEach((value, index) => {
    if (value === null) {
      drawing = false;
      return;
    }
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - ((value - min) / span) * (height - 2) - 1;
    path += drawing ? ` L ${x} ${y}` : `${path.length > 0 ? " " : ""}M ${x} ${y}`;
    drawing = true;
  });
  return path;
}
