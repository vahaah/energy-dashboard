import type { CSSProperties } from "react";

export const CHART_ANIMATION_MS = 0;

export const chartAnimation = {
  isAnimationActive: false,
} as const;

export const chartGrid = {
  vertical: false,
  horizontal: true,
  stroke: "var(--gray-alpha-200)",
  strokeDasharray: "0",
} as const;

export const chartAxisTick = {
  fontSize: 12,
  fill: "var(--gray-700)",
} as const;

export const chartAxisLine = {
  axisLine: false,
  tickLine: false,
} as const;

export const chartTooltipCardStyle: CSSProperties = {
  backgroundColor: "var(--background-100)",
  border: "1px solid var(--gray-alpha-400)",
  borderRadius: 12,
  boxShadow: "var(--card-shadow)",
  color: "var(--gray-1000)",
  fontSize: 14,
  lineHeight: "20px",
  padding: "8px 12px",
};

export const chartCrosshair = {
  stroke: "var(--gray-alpha-400)",
  strokeWidth: 1,
} as const;

export const chartLine = {
  strokeWidth: 1.5,
  isAnimationActive: false,
  dot: false,
  connectNulls: false,
} as const;

export const chartHeroLine = {
  ...chartLine,
  strokeWidth: 2,
} as const;

export const chartArea = {
  isAnimationActive: false,
  fillOpacity: 0.12,
  strokeWidth: 1.5,
} as const;

export const chartStackedArea = {
  isAnimationActive: false,
  fillOpacity: 0.85,
  stroke: "var(--background-100)",
  strokeWidth: 1,
} as const;

export const CHART_HEIGHT_HERO = "h-[200px] sm:h-[280px]";
export const CHART_HEIGHT_SMALL = "h-40";

export const CHART_SERIES_CAP = 6;
