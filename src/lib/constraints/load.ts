import {
  constraintsReleasePath,
  constraintsStore,
  parseConstraintsPointer,
  type ConstraintsPointer,
} from "@/lib/constraints/blob";
import { constraintReleaseSchema, type ConstraintRelease } from "@/lib/constraints/release";

export async function readConstraintsPointer(pathname: string): Promise<ConstraintsPointer | null> {
  const stored = await constraintsStore().get(pathname, false);
  if (!stored) {
    return null;
  }
  return parseConstraintsPointer(stored.body);
}

export async function readConstraintsRelease(releaseId: string): Promise<ConstraintRelease | null> {
  const stored = await constraintsStore().get(constraintsReleasePath(releaseId), true);
  if (!stored) {
    return null;
  }
  try {
    const parsed = constraintReleaseSchema.safeParse(JSON.parse(stored.body));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
