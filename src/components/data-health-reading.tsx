import { Check } from "lucide-react";
import { Absent } from "@/components/ui/absent";
import { DataStateNotice } from "@/components/ui/data-state";
import { visibleDatasetId } from "@/lib/data-health-list";
import { ABSENT_FIGURE } from "@/lib/data-state";
import type { DataHealthReading as Reading } from "@/lib/data-health";

export function DataHealthReading({
  reading,
  featured = false,
}: {
  reading: Reading;
  featured?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <p className={featured ? "text-heading-16 text-gray-1000" : "text-copy-14 text-gray-1000"}>
            {reading.label}
          </p>
          <p className="break-words text-label-12 text-gray-900">
            {[reading.source, visibleDatasetId(reading.dataset_id), reading.expected_cadence]
              .filter((part) => part != null && part !== "")
              .join(" · ")}
          </p>
        </div>
        {reading.state ? (
          <DataStateNotice state={reading.state} />
        ) : (
          <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-gray-alpha-400 px-1.5 py-0.5 text-label-12 text-gray-900">
            <Check className="size-3 shrink-0" aria-hidden="true" />
            Current
          </span>
        )}
      </div>
      <p
        data-figure
        className={
          featured
            ? "whitespace-nowrap font-sans text-heading-32 tabular-nums text-gray-1000"
            : "whitespace-nowrap font-sans text-copy-16 tabular-nums text-gray-1000"
        }
      >
        {reading.value_label === ABSENT_FIGURE ? (
          <Absent reason={reading.state === "not_yet_available" ? "Not yet available" : "Not published"} />
        ) : (
          <>
            <span data-value>{reading.value_label}</span>
            <span data-unit className="align-baseline text-[0.6em] font-medium text-gray-900">
              {"\u2009"}
              {reading.unit}
            </span>
          </>
        )}
      </p>
      <p className="text-label-12 text-gray-900">
        Published{" "}
        <time
          data-clock="published"
          dateTime={reading.published_at ?? undefined}
          className="text-mono-12"
        >
          {reading.published_label}
        </time>
        {" · "}
        Retrieved{" "}
        <time
          data-clock="retrieved"
          dateTime={reading.retrieved_at ?? undefined}
          className="text-mono-12"
        >
          {reading.retrieved_label}
        </time>
      </p>
      {reading.publication_lag_label ? (
        <p className="text-label-12 text-gray-900">{reading.publication_lag_label}</p>
      ) : null}
    </div>
  );
}
