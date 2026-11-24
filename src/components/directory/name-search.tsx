"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { fetchBounded } from "@/lib/http/bounded-json";
import { LookupResults } from "@/components/directory/lookup-result";
import { DataStateNotice } from "@/components/ui/data-state";
import { nameLookupReady, nameLookupRejection, type LookupResult } from "@/lib/directory/lookup";

const FIELD =
  "h-11 w-full min-w-0 max-w-[480px] rounded-md border border-gray-alpha-400 bg-background-100 px-3 text-copy-14 text-gray-1000";
const SEARCH =
  "inline-flex h-11 min-h-6 items-center justify-center self-start rounded-md bg-gray-1000 px-3 text-label-13 text-background-100";
const EXAMPLES = ["Elexon", "Centrica", "Octopus Energy"] as const;

export function DirectoryNameSearch({ defaultDate }: { defaultDate: string }) {
  const [name, setName] = useState("");
  const [effectiveOn, setEffectiveOn] = useState(defaultDate);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<"not_yet_available" | "unavailable" | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [message, setMessage] = useState("");
  const messageRef = useRef<HTMLParagraphElement>(null);
  const messageId = useId();

  useEffect(() => {
    if (message || notice) {
      messageRef.current?.focus();
    }
  }, [message, notice]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setMessage("");
    if (!nameLookupReady(name, effectiveOn)) {
      setResult(null);
      setMessage(nameLookupRejection(name, effectiveOn));
      return;
    }
    setPending(true);
    const params = new URLSearchParams({ name, effective_on: effectiveOn });
    try {
      const response = await fetchBounded(`/api/v1/identifiers?${params.toString()}`);
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
        <input
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={FIELD}
          autoComplete="off"
          aria-invalid={message.length > 0}
          aria-describedby={message ? messageId : undefined}
          placeholder="for example, Elexon…"
        />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-label-13 text-gray-1000">
        Date
        <input type="date" name="effective_on" lang="en-GB" autoComplete="off" value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} className={FIELD} required />
        <span className="text-label-13 font-normal text-gray-900">Example: 23 Oct 2026</span>
      </label>
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setName(example)}
            className="inline-flex h-11 min-h-11 items-center rounded-md border border-gray-alpha-400 px-3 text-label-13 text-gray-1000 sm:h-8 sm:min-h-8"
          >
            {example}
          </button>
        ))}
      </div>
      <button type="submit" className={SEARCH} aria-busy={pending} aria-live="polite" disabled={pending}>
        {pending ? "Searching…" : "Search"}
      </button>
      {notice ? (
        <p ref={messageRef} tabIndex={-1} role="alert">
          <DataStateNotice state={notice} />
        </p>
      ) : null}
      {message ? (
        <p ref={messageRef} id={messageId} tabIndex={-1} role="alert" className="text-copy-14 text-gray-900">
          {message}
        </p>
      ) : null}
      {result ? <LookupResults matches={result.matches} truncated={result.truncated} /> : null}
    </form>
  );
}
