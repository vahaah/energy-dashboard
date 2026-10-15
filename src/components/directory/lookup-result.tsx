import {
  effectiveSentence,
  MPID_LABEL,
  ROLE_LABEL,
  roleStanding,
  SCHEME_LABEL,
} from "@/lib/directory/copy";
import type { LookupMatch } from "@/lib/directory/lookup";

export function LookupResults({ matches, truncated }: { matches: readonly LookupMatch[]; truncated: boolean }) {
  if (matches.length === 0) {
    return <p className="text-copy-14 text-gray-900">Nothing matched.</p>;
  }
  return (
    <div className="flex flex-col gap-5">
      {truncated ? (
        <p className="text-copy-14 text-gray-900">Showing the first matches. Search a narrower name.</p>
      ) : null}
      {matches.map((match) => (
        <article key={matchKey(match)} className="flex min-w-0 flex-col gap-3">
          <h3 className="text-heading-16 text-gray-1000">
            {match.organisation ? match.organisation.name : "No organisation published for this code"}
          </h3>
          {match.organisation ? (
            <p className="text-label-12 text-gray-900">{match.organisation.organisation_id}</p>
          ) : null}
          {match.identifiers.map((identifier) => (
            <div key={`${identifier.scheme}-${identifier.code}-${identifier.effective_from ?? "undated"}`} className="flex min-w-0 flex-col gap-2">
              <p className="text-copy-14 text-gray-1000">
                {SCHEME_LABEL[identifier.scheme]} {identifier.code}
                {identifier.label ? ` · ${identifier.label}` : ""}
              </p>
              {identifier.scheme === "MPID" ? <p className="text-copy-14 text-gray-900">{MPID_LABEL}</p> : null}
              {identifier.dated && identifier.effective_from ? (
                <p className="text-copy-14 text-gray-900">
                  {effectiveSentence(identifier.effective_from, identifier.effective_to)}
                </p>
              ) : identifier.scheme === "GSP_GROUP" ? (
                <p className="text-copy-14 text-gray-900">The source publishes this GSP group without an effective window.</p>
              ) : null}
              {identifier.dated && identifier.current !== null ? (
                <p className="text-label-13 text-gray-1000">{roleStanding(identifier.current)}</p>
              ) : null}
              {identifier.roles.length > 0 ? <p className="text-copy-14 text-gray-900">{ROLE_LABEL}</p> : null}
              <ul className="flex flex-col gap-2">
                {identifier.roles.map((role) => (
                  <li key={`${role.role_code}-${role.effective_from}`} className="min-w-0 text-copy-14 text-gray-900">
                    <span className="text-gray-1000">
                      {role.role_code} {role.role_name}
                    </span>
                    <span className="mt-1 block">{effectiveSentence(role.effective_from, role.effective_to)}</span>
                    <span className="mt-1 block text-label-13 text-gray-1000">{roleStanding(role.current)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </article>
      ))}
    </div>
  );
}

function matchKey(match: LookupMatch): string {
  const organisation = match.organisation?.organisation_id ?? "none";
  const code = match.identifiers.map((item) => `${item.scheme}:${item.code}:${item.effective_from ?? ""}`).join(",");
  return `${organisation}:${code}`;
}
