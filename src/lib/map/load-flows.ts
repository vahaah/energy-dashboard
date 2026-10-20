import { fixtureMapFlows } from "@/lib/map/flows-fixture";
import { buildFlowsPageModel, catalogueFlowsInput } from "@/lib/map/flows-model";
import { readMapFlowsRelease } from "@/lib/map/flows-release";
import type { FlowsPageModel } from "@/lib/map/flows-types";

/** Blob release when the token is set. Otherwise the local fixture. A read failure is an empty feed. */
export async function loadFlowsPageModel(now = new Date()): Promise<FlowsPageModel> {
  const base = catalogueFlowsInput();
  const stored = process.env.BLOB_READ_WRITE_TOKEN ? await readMapFlowsRelease().catch(() => null) : null;
  const fixture = process.env.BLOB_READ_WRITE_TOKEN ? null : fixtureMapFlows(now);
  return buildFlowsPageModel({
    ...base,
    electricity: stored?.electricity ?? fixture?.electricity ?? null,
    gas: stored?.gas ?? fixture?.gas ?? null,
    capacity: stored?.capacity ?? fixture?.capacity ?? null,
  });
}
