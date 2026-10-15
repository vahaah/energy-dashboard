import { revalidatePath } from "next/cache";

/** Projects page and API only. `/` stays on its own revalidation. */
export function revalidateProjectPaths(): void {
  revalidatePath("/projects");
  revalidatePath("/api/v1/projects");
}
