import { ABSENT_FIGURE } from "@/lib/data-state";

/** A missing figure. The dash is never bare: the reason is the accessible name. */
export function Absent({ reason }: { reason: string }) {
  return (
    <span data-absent="true" aria-label={reason}>
      {ABSENT_FIGURE}
    </span>
  );
}
