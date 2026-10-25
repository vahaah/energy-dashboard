import { revalidatePath, revalidateTag } from "next/cache";
import { POWER_CUTS_CACHE_TAG } from "@/lib/power-cuts/schema";

/** Refresh the power-cuts page and the health surfaces. `/` stays on its own 300s revalidate. */
export function revalidatePowerCuts(): void {
  revalidateTag(POWER_CUTS_CACHE_TAG, { expire: 0 });
  revalidatePath("/power-cuts");
  revalidatePath("/data-health");
  revalidatePath("/api/health");
}
