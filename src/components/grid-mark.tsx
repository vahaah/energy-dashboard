type GridMarkProps = {
  className?: string;
  /** Pixel size. Use a multiple of 8 so the 4-unit cells stay on whole pixels. */
  size?: number;
  /** Explicit fill for renderers that do not inherit currentColor, such as OG. */
  color?: string;
};

const MARK_PATH = "M4 4h24v4H8v16h16v-8h-8v-4h12v16H4z";

export function GridMark({ className, size, color = "currentColor" }: GridMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill={color}
      aria-hidden="true"
      shapeRendering="crispEdges"
      className={className ?? (size == null ? "size-6" : undefined)}
    >
      <path d={MARK_PATH} />
    </svg>
  );
}
