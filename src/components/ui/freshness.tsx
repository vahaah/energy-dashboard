import { Absent } from "@/components/ui/absent";
import { DataStateNotice } from "@/components/ui/data-state";

export type FreshnessState = "current" | "stale" | "partial" | "missing";

/**
 * One freshness pattern. Stale is an amber rule plus "Not updated" and the London time.
 * A missing figure is a dash with a reason, never 0.
 */
export function Freshness({
  state,
  asOf,
  detail,
  missingReason = "Not published",
}: {
  state: FreshnessState;
  asOf?: string | null;
  detail?: string | null;
  missingReason?: string;
}) {
  if (state === "missing") {
    return <Absent reason={missingReason} />;
  }
  if (state === "current") {
    return asOf ? <p className="text-copy-14 text-gray-900">as of {asOf}</p> : null;
  }
  const border = state === "stale" ? "border-l-2 border-amber-700 pl-3" : "";
  return (
    <div data-freshness={state} className={`flex min-w-0 flex-col gap-1 ${border}`.trim()}>
      <DataStateNotice state={state === "stale" ? "stale" : "partial"} />
      {asOf ? <p className="text-copy-14 text-gray-900">as of {asOf}</p> : null}
      {detail ? <p className="text-copy-14 text-gray-900">{detail}</p> : null}
    </div>
  );
}
