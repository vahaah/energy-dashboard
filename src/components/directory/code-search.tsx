"use client";

import { useState, type FormEvent } from "react";
import { LookupResults } from "@/components/directory/lookup-result";
import { DataStateNotice } from "@/components/ui/data-state";
import { IDENTIFIER_SCHEMES, SCHEME_INTRO, SCHEME_LABEL, SCHEME_ROLE, type IdentifierScheme } from "@/lib/directory/copy";
import { codeLookupReady, codeLookupRejection, type LookupResult } from "@/lib/directory/lookup";

const FIELD =
  "h-11 w-full min-w-0 max-w-[480px] rounded-md border border-gray-alpha-400 bg-background-100 px-3 text-copy-14 text-gray-1000";
const SEARCH =
  "inline-flex h-11 min-h-6 items-center justify-center self-start rounded-md bg-gray-1000 px-3 text-label-13 text-background-100";
const CODE_EXAMPLES = [
  { scheme: "MPID" as const, label: "MPID" },
  { scheme: "BM_UNIT_ID" as const, label: "BM Unit" },
  { scheme: "GSP_GROUP" as const, label: "GSP group" },
];

export function DirectoryCodeSearch({ defaultDate }: { defaultDate: string }) {
  const [scheme, setScheme] = useState<IdentifierScheme>("MPID");
  const [code, setCode] = useState("");
  const [effectiveOn, setEffectiveOn] = useState(defaultDate);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<"not_yet_available" | "unavailable" | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setMessage("");
    if (!codeLookupReady(scheme, code, effectiveOn)) {
      setResult(null);
      setMessage(codeLookupRejection(scheme, code, effectiveOn));
      return;
    }
    setPending(true);
    const params = new URLSearchParams({ scheme, code, effective_on: effectiveOn });
    try {
      const response = await fetch(`/api/v1/identifiers?${params.toString()}`);
      if (response.status === 404) {
        setResult(null);
        setNotice("not_yet_available");
        return;
      }
      const body = (await response.json()) as LookupResult & { error?: string };
      if (!response.ok) {
        setResult(null);
        setMessage(body.error ?? "The lookup failed.");
        return;
      }
      setResult(body);
    } catch {
      setResult(null);
      setNotice("unavailable");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex min-w-0 flex-col gap-4">
      <p className="text-copy-14 text-gray-900">{SCHEME_INTRO[scheme]}</p>
      <p className="text-copy-14 text-gray-900">{SCHEME_ROLE[scheme]}</p>
      <label className="flex min-w-0 flex-col gap-1 text-label-13 text-gray-1000">
        Scheme
        <select
          value={scheme}
          onChange={(event) => {
            const next = event.target.value;
            if (next === "MPID" || next === "BM_UNIT_ID" || next === "GSP_GROUP") {
              setScheme(next);
              setResult(null);
              setMessage("");
              setNotice(null);
            }
          }}
          className={FIELD}
        >
          {IDENTIFIER_SCHEMES.map((item) => (
            <option key={item} value={item}>
              {SCHEME_LABEL[item]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-label-13 text-gray-1000">
        Code
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className={FIELD}
          autoComplete="off"
          placeholder="for example, a code from the source"
        />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-label-13 text-gray-1000">
        Date
        <input type="date" lang="en-GB" value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} className={FIELD} required />
        <span className="text-label-13 font-normal text-gray-900">Example: 23 Oct 2026</span>
      </label>
      <div className="flex flex-wrap gap-2">
        {CODE_EXAMPLES.map((example) => (
          <button
            key={example.scheme}
            type="button"
            onClick={() => {
              setScheme(example.scheme);
              setCode("");
            }}
            className="inline-flex h-8 items-center rounded-md border border-gray-alpha-400 px-2 text-label-13 text-gray-1000"
          >
            {example.label}
          </button>
        ))}
      </div>
      <button type="submit" className={SEARCH}>
        {pending ? "Searching" : "Search"}
      </button>
      {notice ? <DataStateNotice state={notice} /> : null}
      {message ? <p className="text-copy-14 text-gray-900">{message}</p> : null}
      {result ? <LookupResults matches={result.matches} truncated={result.truncated} /> : null}
    </form>
  );
}
