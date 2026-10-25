import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  CONNECTION_CAPACITY,
  NO_DATE_PUBLISHED,
  PROJECTS_PATH,
  RATED_POWER,
  STORAGE_ENERGY,
} from "@/lib/projects/copy";
import type { ProjectProfile } from "@/lib/projects/page-model";

function StatusGroup({ lines }: { lines: ProjectProfile["statuses"] }) {
  if (lines.length === 0) {
    return <p className="text-copy-14 text-gray-900">Not published</p>;
  }
  return (
    <dl className="flex flex-col gap-4">
      {lines.map((status) => (
        <div key={status.label}>
          <dt className="text-label-13 text-gray-900">{status.label === "Operation" ? "Operational status" : status.label}</dt>
          <dd className="break-words text-copy-16 text-gray-1000">{status.value}</dd>
          {status.date !== NO_DATE_PUBLISHED ? (
            <dd className="mt-1 break-words text-copy-14 text-gray-900">{status.date}</dd>
          ) : null}
          {status.source !== "No source published" ? (
            <dd className="mt-1 break-words text-label-13 text-gray-900">{status.source}</dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

export function ProjectProfileView({ profile }: { profile: ProjectProfile }) {
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12">
        <p className="break-words text-copy-14 text-gray-900">
          {profile.technology} · {profile.country}
        </p>
      </div>
      <div className="col-span-12 lg:col-span-6">
        <Card title="Planning" className="h-full">
          <StatusGroup
            lines={profile.statuses.filter(
              (status) =>
                status.label !== "Connection" &&
                status.value !== "Unknown" &&
                !(status.label === "Operation" && status.value === "Proposed"),
            )}
          />
        </Card>
      </div>
      <div className="col-span-12 lg:col-span-6">
        <Card title="Connection" className="h-full">
          <StatusGroup lines={profile.statuses.filter((status) => status.label === "Connection")} />
          {profile.expectationChange ? (
            <p className="mt-3 break-words text-copy-14 text-gray-900">{profile.expectationCopy}</p>
          ) : null}
        </Card>
      </div>
      <div className="col-span-12">
        <Card title="Measures">
          <dl className="grid min-w-0 gap-3">
            <div>
              <dt className="text-label-13 text-gray-900">{RATED_POWER}</dt>
              <dd className="break-words text-copy-16 text-gray-1000">{profile.power}</dd>
            </div>
            <div>
              <dt className="text-label-13 text-gray-900">{CONNECTION_CAPACITY}</dt>
              <dd className="break-words text-copy-16 text-gray-1000">{profile.connection}</dd>
            </div>
            <div>
              <dt className="text-label-13 text-gray-900">{STORAGE_ENERGY}</dt>
              <dd className="break-words text-copy-16 text-gray-1000">{profile.storage}</dd>
            </div>
          </dl>
        </Card>
      </div>
      <div className="col-span-12">
        <p className="break-words text-copy-14 text-gray-900">
          <Link href={PROJECTS_PATH} className="text-blue-700 underline-offset-2 hover:underline">
            All projects
          </Link>
        </p>
      </div>
    </div>
  );
}
