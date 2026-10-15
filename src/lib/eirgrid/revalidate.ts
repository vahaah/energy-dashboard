import { revalidatePath } from "next/cache";
import { NI_PATH } from "@/lib/eirgrid/copy";

/** Northern Ireland page and API only. `/` stays on its own revalidation. */
export function revalidateNiPaths(): void {
  revalidatePath(NI_PATH);
  revalidatePath("/api/v1/northern-ireland");
  revalidatePath("/data-health");
}
