import { revalidatePath } from "next/cache";

/** Constraint page and API only. `/` stays on its own revalidation. */
export function revalidateConstraintPaths(): void {
  revalidatePath("/system/constraints");
  revalidatePath("/api/v1/constraints");
  revalidatePath("/data-health");
}
