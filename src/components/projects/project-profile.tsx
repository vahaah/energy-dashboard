import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  CONNECTION_CAPACITY,
  PROJECTS_PATH,
  RATED_POWER,
  STORAGE_ENERGY,
} from "@/lib/projects/copy";
import type { ProjectProfile } from "@/lib/projects/page-model";

export function ProjectProfileView({ profile }: { profile: ProjectProfile }) {
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12">
        <p className="break-words text-copy-14 text-gray-900">
          {profile.technology} · {profile.country}
        </p>
      </div>
      {profile.statuses.map((status) => (
        <div key={status.label} className="col-span-12 sm:col-span-6">
          <Card title={status.label} className="h-full">
            <p className="break-words text-heading-24 text-gray-1000">{status.value}</p>
            <p className="mt-2 break-words text-copy-14 text-gray-900">{status.date}</p>
            <p className="mt-2 break-words text-label-12 text-gray-900">{status.source}</p>
            {status.label === "Connection" && profile.expectationChange ? (
              <p className="mt-3 break-words text-copy-14 text-gray-900">{profile.expectationCopy}</p>
            ) : null}
          </Card>
        </div>
      ))}
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
