"use client";

import { useState, type FormEvent } from "react";
import { LookupResults } from "@/components/directory/lookup-result";
import { DataStateNotice } from "@/components/ui/data-state";
import type { LookupResult } from "@/lib/directory/lookup";

const FIELD =
  "h-11 w-full min-w-0 max-w-full rounded-md border border-gray-alpha-400 bg-background-100 px-3 text-copy-14 text-gray-1000";

export function DirectoryNameSearch({ defaultDate }: { defaultDate: string }) {
  const [name, setName] = useState("");
  const [effectiveOn, setEffectiveOn] = useState(defaultDate);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<"not_yet_available" | "unavailable" | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setNotice(null);
    setMessage("");
    const params = new URLSearchParams({ name, effective_on: effectiveOn });
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
      <label className="flex min-w-0 flex-col gap-1 text-label-13 text-gray-1000">
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} className={FIELD} autoComplete="off" />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-label-13 text-gray-1000">
        Date
        <input type="date" value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} className={FIELD} required />
      </label>
      <button
        type="submit"
        className="inline-flex h-11 items-center justify-center self-start rounded-md border border-gray-alpha-400 bg-background-100 px-3 text-label-13 text-gray-1000"
      >
        {pending ? "Searching" : "Search"}
      </button>
      {notice ? <DataStateNotice state={notice} /> : null}
      {message ? <p className="text-copy-14 text-gray-900">{message}</p> : null}
      {result ? <LookupResults matches={result.matches} truncated={result.truncated} /> : null}
    </form>
  );
}
