import { DataHealthReading } from "@/components/data-health-reading";
import { groupHealthReadings, healthSeriesSummary } from "@/lib/data-health-list";
import type { DataHealthReading as Reading } from "@/lib/data-health";

export function DataHealthSeriesList({ readings }: { readings: readonly Reading[] }) {
  const groups = groupHealthReadings(readings);
  const problems = [...groups.notUpdated, ...groups.missing, ...groups.other];
  return (
    <div>
      <p className="text-copy-14 text-gray-1000">{healthSeriesSummary(groups)}</p>
      {problems.length > 0 ? <SeriesItems readings={problems} /> : null}
      {groups.current.length > 0 ? (
        <details className="mt-4 border-t border-gray-alpha-400 pt-4">
          <summary className="cursor-pointer text-copy-14 text-gray-1000">
            Show {groups.current.length} current series
          </summary>
          <SeriesItems readings={groups.current} />
        </details>
      ) : null}
    </div>
  );
}

function SeriesItems({ readings }: { readings: readonly Reading[] }) {
  return (
    <ul className="mt-4 flex flex-col">
      {readings.map((reading) => (
        <li
          key={reading.metric_id}
          className="border-t border-gray-alpha-400 py-4 first:border-t-0 first:pt-0 last:pb-0"
        >
          <DataHealthReading reading={reading} />
        </li>
      ))}
    </ul>
  );
}
