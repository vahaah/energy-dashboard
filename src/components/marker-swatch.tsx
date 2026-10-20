import type { MarkerShape } from "@/lib/map/marker";

/** Map-card marker, drawn at 14px for legends and charts. */
export function MarkerSwatch({ shape, color }: { shape: MarkerShape; color: string }) {
  const common = { fill: color };
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="shrink-0">
      {swatchShape(shape, common)}
    </svg>
  );
}

function swatchShape(shape: MarkerShape, common: { fill: string }) {
  switch (shape) {
    case "circle":
      return <circle cx="7" cy="7" r="5" {...common} />;
    case "square":
      return <rect x="2.2" y="2.2" width="9.6" height="9.6" {...common} />;
    case "triangle":
      return <polygon points="7,1.5 12.2,12 1.8,12" {...common} />;
    case "diamond":
      return <polygon points="7,1.2 12.6,7 7,12.8 1.4,7" {...common} />;
    case "hexagon":
      return <polygon points="7,1.4 11.8,4.2 11.8,9.8 7,12.6 2.2,9.8 2.2,4.2" {...common} />;
    case "plus":
      return <polygon points="5,1.5 9,1.5 9,5 12.5,5 12.5,9 9,9 9,12.5 5,12.5 5,9 1.5,9 1.5,5 5,5" {...common} />;
    case "ring":
      return (
        <>
          <circle cx="7" cy="7" r="5" {...common} />
          <circle cx="7" cy="7" r="2.4" fill="var(--background-100)" />
        </>
      );
    case "triangle-down":
      return <polygon points="7,12.5 12.2,2 1.8,2" {...common} />;
    default: {
      const neverShape: never = shape;
      return neverShape;
    }
  }
}
