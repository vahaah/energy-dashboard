import type { ReactNode } from "react";
import { Absent } from "@/components/ui/absent";
import { DataStateNotice } from "@/components/ui/data-state";

export type FreshnessState = "current" | "stale" | "partial" | "missing";

/**
 * One freshness pattern. Stale is an amber rule plus "Not updated" and the London time.
 * A missing figure is a dash with a reason, never 0.
 */
function AsOfLine({ asOf, asOfDateTime }: { asOf?: string | null; asOfDateTime?: string | null }) {
  if (!asOf) {
    return null;
  }
  return (
    <p className="text-copy-14 text-gray-900">
      as of{" "}
      {asOfDateTime ? (
        <time dateTime={asOfDateTime} data-clock="published">
          {asOf}
        </time>
      ) : (
        asOf
      )}
    </p>
  );
}

export function Freshness({
  state,
  asOf,
  asOfDateTime,
  detail,
  missingReason = "Not published",
}: {
  state: FreshnessState;
  asOf?: string | null;
  /** When set, the as-of stamp is a `<time>` carrying `data-clock="published"`. */
  asOfDateTime?: string | null;
  detail?: ReactNode;
  missingReason?: string;
}) {
  if (state === "missing") {
    return <Absent reason={missingReason} />;
  }
  if (state === "current") {
    return <AsOfLine asOf={asOf} asOfDateTime={asOfDateTime} />;
  }
  const border = state === "stale" ? "border-l-2 border-amber-700 pl-3" : "";
  return (
    <div data-freshness={state} className={`flex min-w-0 flex-col gap-1 ${border}`.trim()}>
      <DataStateNotice state={state === "stale" ? "stale" : "partial"} />
      <AsOfLine asOf={asOf} asOfDateTime={asOfDateTime} />
      {detail ? <div className="text-copy-14 text-gray-900">{detail}</div> : null}
    </div>
  );
}
