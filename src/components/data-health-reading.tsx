import { DataStateNotice } from "@/components/ui/data-state";
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
            {reading.source} · {reading.dataset_id} · {reading.expected_cadence}
          </p>
        </div>
        {reading.state ? <DataStateNotice state={reading.state} /> : null}
      </div>
      <p
        data-figure
        className={
          featured
            ? "whitespace-nowrap font-sans text-heading-32 tabular-nums text-gray-1000"
            : "whitespace-nowrap font-sans text-heading-24 tabular-nums text-gray-1000"
        }
      >
        <span data-value>{reading.value_label}</span>
        <span data-unit className="align-baseline text-gray-700">
          {" "}
          {reading.unit}
        </span>
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
