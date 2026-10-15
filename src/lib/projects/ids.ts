import { createHash } from "node:crypto";
import type { ProjectMember } from "@/lib/projects/schema";

export function projectIdForMembers(members: readonly ProjectMember[]): string {
  const key = members
    .map((member) => `${member.source_id}:${member.external_ref}`)
    .sort()
    .join("|");
  const hex = createHash("sha256").update(key).digest("hex").slice(0, 16);
  return `epj_${hex}`;
}

export function memberKey(member: ProjectMember): string {
  return `${member.source_id}:${member.external_ref}`;
}
