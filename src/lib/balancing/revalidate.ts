import { revalidatePath } from "next/cache";

/** Balancing page, the home card, and the API. `/` stays force-static with revalidate 300. */
export function revalidateBalancingPaths(): void {
  revalidatePath("/system/balancing");
  revalidatePath("/");
  revalidatePath("/llms.txt");
}
