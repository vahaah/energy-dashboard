import { fetchTecStep, publishTecStep, takeTecSlotStep, validateTecStep } from "@/workflows/steps/tec";

/**
 * NESO TEC register, twice a week. Four steps, sequential.
 * One package lookup and one CSV. Tinybird ops: 0.
 * A fatal step leaves the previous pointer in place.
 */
export async function tecRegister(slot: string, owner: string, nowIso: string) {
  "use workflow";
  await takeTecSlotStep(slot, owner);
  const fetched = await fetchTecStep(nowIso);
  await validateTecStep(fetched.hash, nowIso, fetched.raw, fetched.meta);
  await publishTecStep(fetched.hash, nowIso, fetched.raw, fetched.meta);
}
