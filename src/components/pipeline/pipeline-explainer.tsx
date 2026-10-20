"use client";

import { useState } from "react";
import { PIPELINE_EXPLAINER, PIPELINE_EXPLAINER_LABEL } from "@/lib/pipeline/copy";

export function PipelineExplainer() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <h2 className="hidden text-heading-16 text-gray-1000 md:block">{PIPELINE_EXPLAINER_LABEL}</h2>
      <button
        type="button"
        className="inline-flex min-h-11 items-center text-left text-copy-14 text-gray-1000 md:hidden"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {PIPELINE_EXPLAINER_LABEL}
      </button>
      <ol className={open ? "mt-2 flex min-w-0 flex-col gap-4" : "mt-2 hidden min-w-0 flex-col gap-4 md:flex"}>
        {PIPELINE_EXPLAINER.map((section) => (
          <li key={section.title} className="min-w-0">
            <h3 className="text-heading-16 text-gray-1000">{section.title}</h3>
            <p className="mt-1 break-words text-copy-14 text-gray-900">{section.body}</p>
          </li>
        ))}
      </ol>
    </>
  );
}
