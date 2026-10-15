import { blobReadOrNull } from "@/lib/blob-read";
import { NI_LATEST_PATH, niReleasePath, niStore, parseNiPointer } from "@/lib/eirgrid/blob";
import { niReleaseSchema, type NiRelease } from "@/lib/eirgrid/release";
import { EIRGRID_SERIES, type EirgridMetricId } from "@/lib/eirgrid/spec";

export type NiObservation = {
  metricId: EirgridMetricId;
  value: number | null;
  publishedAt: string | null;
  retrievedAt: string | null;
};

/** Blob only. A missing pointer is not yet available. The page fixture is not a health reading. */
export async function loadNiObservations(): Promise<NiObservation[]> {
  const release = await readStoredRelease();
  return EIRGRID_SERIES.map((spec) => {
    const series = release?.series.find((row) => row.metric_id === spec.metric_id);
    const point = [...(series?.points ?? [])].reverse().find((row) => row.value != null);
    return {
      metricId: spec.metric_id,
      value: point?.value ?? null,
      publishedAt: point?.time ?? null,
      retrievedAt: release?.retrieved_at ?? null,
    };
  });
}

async function readStoredRelease(): Promise<NiRelease | null> {
  try {
    const pointerText = await blobReadOrNull(() => niStore().get(NI_LATEST_PATH, false));
    const pointer = pointerText ? parseNiPointer(pointerText.body) : null;
    if (!pointer) {
      return null;
    }
    const file = await blobReadOrNull(() => niStore().get(niReleasePath(pointer.release_id), false));
    if (!file) {
      return null;
    }
    return niReleaseSchema.parse(JSON.parse(file.body));
  } catch {
    return null;
  }
}
