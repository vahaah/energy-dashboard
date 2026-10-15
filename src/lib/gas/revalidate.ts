import { revalidatePath } from "next/cache";

/** Gas pages and gas APIs only. `/` stays on its own revalidation. */
export function revalidateGasPaths(): void {
  revalidatePath("/gas");
  revalidatePath("/api/v1/gas/overview");
  revalidatePath("/api/v1/gas/series");
}
