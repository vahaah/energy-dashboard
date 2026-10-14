export function clampTooltipLeft(
  anchorLeft: number,
  anchorWidth: number,
  viewportWidth: number,
  tooltipWidth = 280,
  gutter = 16,
  align: "center" | "end" = "center"
): { left: number; width: number } {
  const width = Math.min(tooltipWidth, Math.max(0, viewportWidth - gutter * 2));
  let preferred: number;
  switch (align) {
    case "end":
      preferred = anchorLeft + anchorWidth - width;
      break;
    case "center":
      preferred = anchorLeft + anchorWidth / 2 - width / 2;
      break;
    default: {
      const exhaustive: never = align;
      return exhaustive;
    }
  }
  const maxLeft = Math.max(gutter, viewportWidth - width - gutter);
  const left = Math.min(Math.max(gutter, preferred), maxLeft);
  return { left, width };
}

export function placeTooltipTop(
  anchorTop: number,
  anchorHeight: number,
  tooltipHeight: number,
  viewportHeight: number,
  gutter = 8,
  gap = 8
): number {
  const above = anchorTop - gap - tooltipHeight;
  if (above >= gutter) {
    return above;
  }
  const below = anchorTop + anchorHeight + gap;
  const maxTop = Math.max(gutter, viewportHeight - tooltipHeight - gutter);
  return Math.min(Math.max(gutter, below), maxTop);
}
