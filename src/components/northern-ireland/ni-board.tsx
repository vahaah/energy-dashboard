"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";
import { Sparkline } from "@/components/sparkline";
import { Absent } from "@/components/ui/absent";
import { CARD_GRID_CLASS, Card } from "@/components/ui/card";
import { DataStateNotice } from "@/components/ui/data-state";
import { Freshness } from "@/components/ui/freshness";
import { Quantity } from "@/components/ui/quantity";
import { ABSENT_FIGURE } from "@/lib/data-state";
import { NI_SCOPE_ALL, NI_SCOPE_NI } from "@/lib/eirgrid/copy";
import type { NiFigure, NiPageModel, NiScopeId, NiScopeModel } from "@/lib/eirgrid/page-model";

export function NiBoard({ model }: { model: NiPageModel }) {
  const [scope, setScope] = useState<NiScopeId>("ni");
  return (
    <Tabs
      value={scope}
      onValueChange={(next) => {
        if (next === "ni" || next === "all") {
          setScope(next);
        }
      }}
      className="flex min-w-0 flex-col gap-4"
    >
      <TabsList aria-label="Scope" className="flex min-w-0 flex-wrap gap-2">
        {model.scopes.map((item) => (
          <TabsTab
            key={item.id}
            value={item.id}
            className="inline-flex min-h-11 items-center rounded-md border border-gray-alpha-400 px-3 text-label-13 text-gray-900 data-selected:border-gray-1000 data-selected:bg-background-100 data-selected:text-gray-1000"
          >
            {item.id === "ni" ? NI_SCOPE_NI : NI_SCOPE_ALL}
          </TabsTab>
        ))}
      </TabsList>
      {model.scopes.map((item) => (
        <TabsPanel key={item.id} value={item.id}>
          <ScopePanel model={item} />
        </TabsPanel>
      ))}
    </Tabs>
  );
}

function ScopePanel({ model }: { model: NiScopeModel }) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
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
  const missing = figure.value === ABSENT_FIGURE;
  return (
    <Card title={figure.label} footer={<p className="break-words">{figure.sourceLine}</p>}>
      <Freshness state={figure.freshness} asOf={figure.asOf} />
      {figure.forecast ? <DataStateNotice state="forecast" /> : null}
      <p className="break-words text-heading-24 text-gray-1000">
        {missing ? <Absent reason="Not yet published" /> : <Quantity value={figure.value} unit={figure.unit} />}
      </p>
      {figure.spark.length > 1 ? (
        <div className="mt-3">
          <Sparkline values={figure.spark} color="var(--chart-wind)" label={`${figure.label} half-hour readings`} />
        </div>
      ) : null}
      {figure.groups.map((group) => (
        <div key={`${figure.metricId}-${group.caption}`} className="mt-4">
          <p className="text-copy-14 text-gray-900">Times on {group.caption}</p>
          <ul className="mt-2 flex flex-col">
            {group.rows.map((row) => (
              <li
                key={`${figure.metricId}-${group.caption}-${row.time}`}
                className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-gray-alpha-400 py-2 first:border-t-0"
              >
                <span className="min-w-0 break-words text-copy-14 text-gray-900">{row.time}</span>
                <span className="text-mono-13 text-gray-1000">
                  {row.value === ABSENT_FIGURE ? <Absent reason="Not yet published" /> : row.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Card>
  );
}
