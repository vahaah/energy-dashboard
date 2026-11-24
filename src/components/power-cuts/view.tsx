"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { PowerCutsMap } from "@/components/power-cuts/map";
import { PostcodeList } from "@/components/power-cuts/postcode-list";
import { OfgemContext } from "@/components/power-cuts/ofgem-chart";
import { Absent } from "@/components/ui/absent";
import { Card, CARD_GRID_CLASS } from "@/components/ui/card";
import { Freshness } from "@/components/ui/freshness";
import { Quantity } from "@/components/ui/quantity";
import { TableScroll } from "@/components/ui/table-scroll";
import { formatGrouped } from "@/lib/format/quantity";
import { osBasemapAttribution } from "@/lib/map/constants";
import {
  NPG_OPEN_DATA_LICENCE_URL,
  NPG_POWER_CUTS_ATTRIBUTION,
} from "@/lib/attribution";
import {
  ALL_FEEDS_FAILED,
  NO_POWER_CUTS,
  POWER_CUT_CREDITS,
  POWER_CUTS_CALL_105,
  POWER_CUTS_CALL_NI,
  operatorName,
} from "@/lib/power-cuts/copy";
import {
  buildPowerCutsModel,
  outwardQuery,
  POWER_CUTS_PAGE_SIZE,
  type PowerCutsPageModel,
} from "@/lib/power-cuts/model";
import type { OfgemCiCml } from "@/lib/power-cuts/ofgem";
import { OPERATORS, type Operator, type PowerCutKind, type PowerCutsSnapshot } from "@/lib/power-cuts/schema";

function applyPreview(snapshot: PowerCutsSnapshot, preview: string | null): PowerCutsSnapshot {
  if (preview === "empty") {
    return {
      ...snapshot,
      incidents: [],
      sources: Object.fromEntries(
        OPERATORS.map((operator) => [operator, { ...snapshot.sources[operator], count: snapshot.sources[operator].status === "ok" ? 0 : snapshot.sources[operator].count }]),
      ) as PowerCutsSnapshot["sources"],
    };
  }
  if (preview === "absent") {
    return {
      ...snapshot,
      incidents: [],
      sources: Object.fromEntries(
        OPERATORS.map((operator) => {
          const current = snapshot.sources[operator];
          if (current.status === "unlicensed") {
            return [operator, current];
          }
          return [operator, { status: "absent", fetchedAt: null, count: 0, error: "The feed could not be read." }];
        }),
      ) as PowerCutsSnapshot["sources"],
    };
  }
  return snapshot;
}

const PREVIEW_PENDING = "pending";

function subscribePreview(): () => void {
  return () => {};
}

function previewFromLocation(): string {
  const state = new URLSearchParams(window.location.search).get("state");
  if (state === "empty" || state === "absent") {
    return state;
  }
  return "ready";
}

function previewOnServer(): string {
  return PREVIEW_PENDING;
}

function Customers({ model }: { model: PowerCutsPageModel }) {
  if (model.customersOff == null) {
    return <Absent reason="No operator published a customer count" />;
  }
  return <Quantity value={formatGrouped(model.customersOff, 0)} unit="customers" />;
}

export function PowerCutsView({
  snapshot,
  nowIso,
  ofgem,
}: {
  snapshot: PowerCutsSnapshot | null;
  nowIso: string;
  ofgem: OfgemCiCml | null;
}) {
  const previewState = useSyncExternalStore(subscribePreview, previewFromLocation, previewOnServer);
  const settled = previewState !== PREVIEW_PENDING;
  const preview = previewState === "empty" || previewState === "absent" ? previewState : null;
  const [query, setQuery] = useState("");
  const [operator, setOperator] = useState<"all" | Operator>("all");
  const [kind, setKind] = useState<"all" | PowerCutKind>("all");
  const [page, setPage] = useState(0);

  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const shown = snapshot && settled ? applyPreview(snapshot, preview) : snapshot;
  const model = shown ? buildPowerCutsModel(shown, now) : null;
  const state = !settled ? "pending" : preview === "empty" ? "empty" : preview === "absent" ? "absent" : "ready";
  const filtered = (model?.list ?? []).filter((incident) => {
    if (operator !== "all" && incident.operator !== operator) {
      return false;
    }
    if (kind !== "all" && incident.kind !== kind) {
      return false;
    }
    return outwardQuery(incident.postcodes, query);
  });
  const pages = Math.max(1, Math.ceil(filtered.length / POWER_CUTS_PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const visible = filtered.slice(safePage * POWER_CUTS_PAGE_SIZE, safePage * POWER_CUTS_PAGE_SIZE + POWER_CUTS_PAGE_SIZE);
  const showMap = state === "ready" && (model?.list.some((incident) => incident.point) ?? false);

  return (
    <div data-power-cuts-state={settled ? state : undefined} className="flex min-w-0 flex-col gap-8">
      {model ? (
        <>
          <p className="max-w-3xl text-copy-16 text-gray-1000">{model.answer}</p>
          <Freshness state={model.freshness} asOf={model.asOf} detail={model.freshnessDetail} missingReason="No operator feed is in this snapshot" />
          <p className="max-w-3xl text-copy-14 text-gray-900">{model.coverage}</p>
          <p>
            <a className="text-copy-16 text-blue-700 underline-offset-2 hover:underline" href={NPG_OPEN_DATA_LICENCE_URL}>
              {NPG_POWER_CUTS_ATTRIBUTION}
            </a>
          </p>
          {model.allFailed ? (
            <p className="text-copy-14 text-gray-900">
              {ALL_FEEDS_FAILED} Last snapshot {model.snapshotAge}.
            </p>
          ) : null}
          <div className={CARD_GRID_CLASS}>
            <Card title="Live incidents" size="stat">
              <p className="text-heading-32 text-gray-1000">
                <Quantity value={formatGrouped(model.incidents, 0)} unit="incidents" />
              </p>
            </Card>
            <Card title="Customers off supply" size="stat">
              <p className="text-heading-32 text-gray-1000">
                <Customers model={model} />
              </p>
              <p className="mt-2 text-copy-14 text-gray-900">Customer totals leave out incidents with no published count.</p>
            </Card>
            <Card title="Unplanned and planned" size="stat">
              {model.incidents === 0 ? (
                <p className="text-copy-14 text-gray-900">{NO_POWER_CUTS}</p>
              ) : (
                <>
                  <div className="flex h-2 overflow-hidden rounded-full" aria-hidden="true">
                    <div className="bg-chart-gas" style={{ width: `${model.unplannedPercent}%` }} />
                    <div className="bg-chart-wind" style={{ width: `${model.plannedPercent}%` }} />
                  </div>
                  <p className="mt-2 text-copy-14 text-gray-900">
                    {formatGrouped(model.unplanned, 0)} unplanned ({model.unplannedPercent}%). {formatGrouped(model.planned, 0)} planned ({model.plannedPercent}%).
                  </p>
                </>
              )}
            </Card>
            <Card title="Operators reporting" size="stat">
              <p className="text-heading-32 text-gray-1000">
                <Quantity value={`${model.operatorsReporting}/${model.operatorTotal}`} unit="operators" />
              </p>
            </Card>
          </div>
          <section aria-labelledby="by-area">
            <h2 id="by-area" className="text-heading-24 text-gray-1000">
              By area
            </h2>
            {model.rows.length === 0 ? (
              <p className="mt-3 text-copy-16 text-gray-1000">{NO_POWER_CUTS}</p>
            ) : (
              <TableScroll className="mt-4">
                <table className="w-full min-w-[40rem] border-collapse text-left text-copy-14">
                  <thead>
                    <tr className="text-label-13 text-gray-900">
                      <th className="py-2 pr-3 font-medium">Area</th>
                      <th className="py-2 pr-3 font-medium">Operator</th>
                      <th className="py-2 pr-3 font-medium">Nation</th>
                      <th className="py-2 pr-3 font-medium">Incidents</th>
                      <th className="py-2 pr-3 font-medium">Customers off</th>
                      <th className="py-2 pr-3 font-medium">Unplanned</th>
                      <th className="py-2 font-medium">Planned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.rows.map((row) => (
                      <tr
                        key={`${row.row}-${row.nation ?? "all"}-${row.area ?? "all"}-${row.operator ?? "all"}`}
                        data-row={row.row}
                        className={`border-t border-gray-alpha-400 ${row.row === "area" ? "" : "font-medium"}`}
                      >
                        <th scope="row" className="py-3 pr-3 text-left text-gray-1000">
                          {row.label}
                        </th>
                        <td className="py-3 pr-3">{row.operator ? operatorName(row.operator) : ""}</td>
                        <td className="py-3 pr-3">{row.nation ?? ""}</td>
                        <td className="py-3 pr-3 tabular-nums">{formatGrouped(row.incidents, 0)}</td>
                        <td className="py-3 pr-3 tabular-nums">
                          {row.customersShown == null ? (
                            <Absent reason="No published count" />
                          ) : (
                            formatGrouped(row.customersShown, 0)
                          )}
                        </td>
                        <td className="py-3 pr-3 tabular-nums">{formatGrouped(row.unplanned, 0)}</td>
                        <td className="py-3 tabular-nums">{formatGrouped(row.planned, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </section>
          {showMap ? (
            <section aria-labelledby="power-cuts-map">
              <h2 id="power-cuts-map" className="text-heading-24 text-gray-1000">
                Map
              </h2>
              <p className="mt-2 text-copy-14 text-gray-900">
                <span className="mr-3 inline-flex items-center gap-2">
                  <span className="inline-block size-2 rounded-full bg-chart-gas" /> Unplanned
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block size-2 rounded-full bg-chart-wind" /> Planned
                </span>
              </p>
              <p className="mt-1 text-copy-14 text-gray-900">
                Each licence area is shaded. Grey means that area has no reported cut.
              </p>
              <div className="mt-4">
                <PowerCutsMap incidents={model.list} />
              </div>
              <p className="mt-2 text-copy-14 text-gray-900">{osBasemapAttribution(now.getUTCFullYear())}</p>
            </section>
          ) : null}
          <section aria-labelledby="incident-list">
            <h2 id="incident-list" className="text-heading-24 text-gray-1000">
              Incidents
            </h2>
            <div className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
              <label className="flex min-w-0 flex-col gap-1 text-label-13 text-gray-900">
                Outward postcode
                <input
                  name="outward"
                  autoComplete="off"
                  spellCheck={false}
                  value={query}
                  placeholder="for example, SW1A…"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(0);
                  }}
                  className="h-11 min-h-11 w-full min-w-0 rounded-lg border border-gray-alpha-400 bg-background-100 px-3 text-copy-14 text-gray-1000 sm:w-40"
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-label-13 text-gray-900">
                Operator
                <select
                  name="operator"
                  autoComplete="off"
                  value={operator}
                  onChange={(event) => {
                    setOperator(event.target.value as "all" | Operator);
                    setPage(0);
                  }}
                  className="h-11 min-h-11 w-full min-w-0 max-w-full rounded-lg border border-gray-alpha-400 bg-background-100 px-3 text-copy-14 text-gray-1000 sm:w-64"
                >
                  <option value="all">All operators</option>
                  {OPERATORS.map((item) => (
                    <option key={item} value={item}>
                      {operatorName(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-label-13 text-gray-900">
                Kind
                <select
                  name="kind"
                  autoComplete="off"
                  value={kind}
                  onChange={(event) => {
                    setKind(event.target.value as "all" | PowerCutKind);
                    setPage(0);
                  }}
                  className="h-11 min-h-11 w-full min-w-0 max-w-full rounded-lg border border-gray-alpha-400 bg-background-100 px-3 text-copy-14 text-gray-1000 sm:w-56"
                >
                  <option value="all">Planned and unplanned</option>
                  <option value="unplanned">Unplanned</option>
                  <option value="planned">Planned</option>
                </select>
              </label>
            </div>
            {visible.length === 0 ? (
              <p className="mt-4 text-copy-16 text-gray-1000">{NO_POWER_CUTS}</p>
            ) : (
              <ol className="mt-4 flex flex-col">
                {visible.map((incident) => (
                  <li key={incident.id} className="border-t border-gray-alpha-400 py-4">
                    <p className="text-copy-16 text-gray-1000">
                      {incident.operatorLabel}, {incident.areaLabel}
                    </p>
                    <p className="text-copy-14 text-gray-900">
                      {incident.kind === "planned" ? "Planned" : "Unplanned"}
                      {". "}
                      {incident.customersOff == null ? (
                        <Absent reason="Customer count is not published" />
                      ) : (
                        <Quantity value={formatGrouped(incident.customersOff, 0)} unit="customers" />
                      )}
                      {". "}
                      {incident.startedLabel}. {incident.restorationLabel}.
                    </p>
                    <PostcodeList postcodes={incident.postcodes} />
                  </li>
                ))}
              </ol>
            )}
            {pages > 1 ? (
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  className="inline-flex h-11 min-h-11 items-center rounded-lg border border-gray-alpha-400 px-3 text-copy-14 disabled:opacity-40"
                  disabled={safePage === 0}
                  onClick={() => setPage(safePage - 1)}
                >
                  Previous
                </button>
                <p className="text-copy-14 text-gray-900">
                  {safePage + 1} of {pages}
                </p>
                <button
                  type="button"
                  className="inline-flex h-11 min-h-11 items-center rounded-lg border border-gray-alpha-400 px-3 text-copy-14 disabled:opacity-40"
                  disabled={safePage >= pages - 1}
                  onClick={() => setPage(safePage + 1)}
                >
                  Next
                </button>
              </div>
            ) : null}
          </section>
        </>
      ) : (
        <p className="text-copy-16 text-gray-1000">Not yet available.</p>
      )}
      <section className="rounded-xl border border-gray-alpha-400 p-4" aria-labelledby="call-105">
        <h2 id="call-105" className="text-heading-24 text-gray-1000">
          {POWER_CUTS_CALL_105}
        </h2>
        <p className="mt-2 text-copy-14 text-gray-900">105 is free from a landline or a mobile, anywhere in Great Britain.</p>
        <p className="mt-2 text-copy-14 text-gray-900">{POWER_CUTS_CALL_NI}. Northern Ireland faults are not in this feed.</p>
      </section>
      {ofgem ? <OfgemContext data={ofgem} /> : null}
      <section aria-labelledby="sources">
        <h2 id="sources" className="text-heading-24 text-gray-1000">
          Sources
        </h2>
        <ul className="mt-3 flex flex-col gap-3">
          {POWER_CUT_CREDITS.map((credit) => (
            <li key={credit.operator} className="text-copy-14 text-gray-900">
              <a className="text-blue-700 underline-offset-2 hover:underline" href={credit.licenceUrl ?? credit.url}>
                {credit.attribution}
              </a>
            </li>
          ))}
        </ul>
      </section>
      {model && model.notices.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {model.notices.map((notice) => (
            <li key={notice.operator} className="text-copy-14 text-gray-900" data-source-status={notice.status}>
              {notice.name}: {notice.error}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
