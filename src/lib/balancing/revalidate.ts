import { revalidatePath } from "next/cache";

/** Balancing page and API only. `/` keeps revalidate 300 and does not read Blob. */
export function revalidateBalancingPaths(): void {
  revalidatePath("/system/balancing");
}
