import Link from "next/link";
import { Card } from "@/components/ui/card";
import { DataStateNotice } from "@/components/ui/data-state";
import type { ChangeSource } from "@/lib/changes/query";

export type ChangeCard = {
  key: string;
  name: string;
  href: string | null;
  sentence: string;
  evidence: string;
  status: string | null;
  observedAt: string;
  effectiveAt: string | null;
};

export function ChangesBoard({ rows, attribution }: { rows: ChangeCard[]; attribution: string }) {
  if (rows.length === 0) {
    return (
      <Card title="Comparisons">
        <DataStateNotice state="not_yet_available" />
      </Card>
    );
  }
  return (
    <Card title="Comparisons" footer={<p className="break-words">{attribution}</p>}>
      <div className="flex min-w-0 flex-col">
        <p className="text-copy-14 text-gray-900">
          {rows.length} {rows.length === 1 ? "comparison" : "comparisons"}
        </p>
        {rows.map((row) => (
          <article key={row.key} className="mt-4 min-w-0 border-t border-gray-alpha-400 pt-4">
            <h2 className="break-words text-heading-16 text-gray-1000">
              {row.href ? (
                <Link href={row.href} className="text-blue-700 underline-offset-2 hover:underline">
                  {row.name}
                </Link>
              ) : (
                row.name
              )}
            </h2>
            <p className="mt-2 break-words text-copy-14 text-gray-1000">{row.sentence}</p>
            <p className="mt-2 break-all text-label-12 text-gray-900">{row.evidence}</p>
            {row.status ? <p className="mt-2 break-words text-label-12 text-gray-900">{row.status}</p> : null}
            <p className="mt-2 break-words text-label-12 text-gray-900">
              Observed {row.observedAt}
              {row.effectiveAt ? ` · Effective ${row.effectiveAt}` : ""}
            </p>
          </article>
        ))}
      </div>
    </Card>
  );
}

export function attributionLine(sources: readonly ChangeSource[]): string {
  return sources
    .map((source) => source.attribution)
    .filter((line) => line.length > 0)
    .join(" ");
}
