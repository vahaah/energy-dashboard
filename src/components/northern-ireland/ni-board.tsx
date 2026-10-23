"use client";

import { useState } from "react";
import { Absent } from "@/components/ui/absent";
import { CARD_GRID_CLASS, Card } from "@/components/ui/card";
import { DataStateNotice } from "@/components/ui/data-state";
import { Quantity } from "@/components/ui/quantity";
import { ABSENT_FIGURE } from "@/lib/data-state";
import { NI_SCOPE_ALL, NI_SCOPE_NI } from "@/lib/eirgrid/copy";
import type { NiFigure, NiPageModel, NiScopeId, NiScopeModel } from "@/lib/eirgrid/page-model";

export function NiBoard({ model }: { model: NiPageModel }) {
  const [scope, setScope] = useState<NiScopeId>("ni");
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div role="tablist" aria-label="Scope" className="flex min-w-0 flex-wrap gap-2">
        {model.scopes.map((item) => {
          const selected = item.id === scope;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`inline-flex min-h-11 items-center rounded-md border px-3 text-label-13 focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:outline-none ${
                selected
                  ? "border-gray-1000 bg-background-100 text-gray-1000"
                  : "border-gray-alpha-400 text-gray-900 hover:text-gray-1000"
              }`}
              onClick={() => setScope(item.id)}
            >
              {item.id === "ni" ? NI_SCOPE_NI : NI_SCOPE_ALL}
            </button>
          );
        })}
      </div>
      {model.scopes.map((item) => (
        <ScopePanel key={item.id} model={item} hidden={item.id !== scope} />
      ))}
    </div>
  );
}

function ScopePanel({ model, hidden }: { model: NiScopeModel; hidden: boolean }) {
  return (
    <div hidden={hidden} className="flex min-w-0 flex-col gap-4">
      <div className={CARD_GRID_CLASS}>
        {model.figures.map((figure) => (
          <FigureCard key={figure.metricId} figure={figure} />
        ))}
      </div>
      <Card title="Fuel mix" footer={<p>{model.fuelSourceLine}</p>}>
        <ul className="flex flex-col">
          {model.fuels.map((row) => (
            <li
              key={row.metricId}
              className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-gray-alpha-400 py-3 first:border-t-0 first:pt-0 last:pb-0"
            >
              <span className="min-w-0 break-words text-copy-14 text-gray-1000">{row.label}</span>
              <span className="text-mono-13 text-gray-1000">
                {row.mwh}
                {row.share ? ` · ${row.share}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      {model.semo.length > 0 ? (
        <div className={CARD_GRID_CLASS}>
          {model.semo.map((figure) => (
            <FigureCard key={figure.metricId} figure={figure} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FigureCard({ figure }: { figure: NiFigure }) {
  return (
    <Card title={figure.label} footer={<p className="break-words">{figure.sourceLine}</p>}>
      {figure.forecast ? <DataStateNotice state="forecast" /> : null}
      <p className="break-words text-heading-24 text-gray-1000">
        {figure.value === ABSENT_FIGURE ? (
          <Absent reason="Not yet published" />
        ) : (
          <Quantity value={figure.value} unit={figure.unit} />
        )}
      </p>
      <ul className="mt-4 flex flex-col">
        {figure.rows.map((row) => (
          <li
            key={`${figure.metricId}-${row.time}`}
            className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-gray-alpha-400 py-2 first:border-t-0"
          >
            <span className="min-w-0 break-words text-mono-12 text-gray-900">{row.time}</span>
            <span className="text-mono-13 text-gray-1000">
              {row.value === ABSENT_FIGURE ? <Absent reason="Not yet published" /> : row.value}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
