import { Card } from "@/components/ui/card";
import type { LayerPointer } from "@/lib/map/layer-flag";

export function MapLayerChangeNotice({ pointer }: { pointer: LayerPointer }) {
  return (
    <section>
      <h2 className="text-heading-24 text-gray-1000">Map layers</h2>
      <Card className="mt-4" title="DNO licence areas">
        <p className="text-copy-14 text-gray-1000">
          NESO published a new DNO licence-area extract. The map still uses edition {pointer.edition}.
        </p>
        <p className="mt-2 text-label-12 text-gray-900">
          Checked <time dateTime={pointer.checked_at}>{pointer.checked_at}</time>. Published file{" "}
          <span className="text-mono-12">{pointer.sha256}</span> is unchanged. Source hash{" "}
          <span className="text-mono-12">{pointer.source_sha256}</span>.
        </p>
      </Card>
    </section>
  );
}
