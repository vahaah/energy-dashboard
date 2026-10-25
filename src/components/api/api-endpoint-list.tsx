"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { TableScroll } from "@/components/ui/table-scroll";
import type { ApiDocsEndpoint } from "@/lib/api/copy";

export function ApiEndpointList({
  endpoints,
}: {
  endpoints: readonly (ApiDocsEndpoint & { curl: string })[];
}) {
  return (
    <div className="mt-4 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start lg:gap-6">
      <nav aria-label="Endpoints" className="mb-4 lg:sticky lg:top-24">
        <ul className="flex flex-col gap-1">
          {endpoints.map((endpoint) => (
            <li key={endpoint.path}>
              <a
                href={`#${endpointAnchor(endpoint.path)}`}
                className="inline-flex min-h-11 items-center break-all text-copy-14 text-blue-700 underline-offset-2 hover:underline"
              >
                {endpoint.path}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="space-y-4">
        {endpoints.map((endpoint) => (
          <Card key={`${endpoint.method} ${endpoint.path}`} title={endpoint.path}>
            <div id={endpointAnchor(endpoint.path)} className="scroll-mt-28">
              <p className="text-label-13 text-gray-900">
                <span className="inline-flex h-6 items-center rounded-md border border-gray-alpha-400 px-1.5 text-label-13 text-gray-1000">
                  {endpoint.method}
                </span>
              </p>
              <p className="mt-2 break-words text-copy-14 text-gray-900">{endpoint.summary}</p>
              <p className="mt-2 break-words text-copy-14 text-gray-900">{endpoint.note}</p>
              <div className="mt-3 flex items-start justify-between gap-3">
                <TableScroll className="min-w-0 flex-1">
                  <pre className="w-max min-w-full rounded-lg border border-gray-alpha-400 bg-background-200 p-3 text-mono-12 text-gray-1000">
                    {endpoint.curl}
                  </pre>
                </TableScroll>
                <CopyCurl text={endpoint.curl} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CopyCurl({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        });
      }}
      className="inline-flex h-8 min-h-11 shrink-0 items-center rounded-md border border-gray-alpha-400 px-3 text-label-13 text-gray-1000 sm:min-h-8"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function endpointAnchor(path: string): string {
  return path.replaceAll("/", "").replaceAll(/[^a-z0-9-]/gi, "-");
}
