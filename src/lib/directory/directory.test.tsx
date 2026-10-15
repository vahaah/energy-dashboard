import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LookupResults } from "@/components/directory/lookup-result";
import { MemoryDirectoryStore } from "@/lib/directory/blob";
import { buildDirectory, sameCodeDifferentScheme } from "@/lib/directory/build";
import { checkDirectoryFixtures } from "@/lib/directory/check";
import {
  effectiveSentence,
  MPID_LABEL,
  REDISTRIBUTION_NOT_PERMITTED,
  ROLE_LABEL,
  roleStanding,
} from "@/lib/directory/copy";
import { ingestDirectory, isdEntityUrl, ISD_LOOKUP_FILTERS } from "@/lib/directory/ingest";
import { lookupByCode, parseResolveBody, resolveLogFields } from "@/lib/directory/lookup";
import { fixtureDirectoryExtracts, fixtureDirectorySnapshot } from "@/lib/directory/reader";
import { GET as exportGet, POST as exportPost } from "@/app/api/v1/identifiers/export/route";
import { GET as lookupGet } from "@/app/api/v1/identifiers/route";
import { POST as resolvePost } from "@/app/api/v1/identifiers/resolve/route";

const RECORDED_AT = "2026-10-15T06:15:00.000Z";
const ON = "2026-10-15";

describe("directory lookup", () => {
  it("keeps shared names apart, namespaces apart, and an expired role off current", () => {
    expect(checkDirectoryFixtures()).toEqual([]);
    const snapshot = fixtureDirectorySnapshot();
    const north = snapshot.organisations.filter((org) => org.name === "North Power Limited");
    expect(north.map((org) => org.organisation_id).sort()).toEqual(["org_11111111", "org_22222222"]);
    expect(sameCodeDifferentScheme("MPID", "GSP_GROUP", "_A")).toBe(true);
    expect(sameCodeDifferentScheme("MPID", "BM_UNIT_ID", "2__ANPOW000")).toBe(true);

    const npow = lookupByCode(snapshot, "MPID", "NPOW", ON);
    const expired = npow.matches
      .flatMap((match) => match.identifiers)
      .flatMap((identifier) => identifier.roles)
      .find((role) => role.effective_to === "2020-01-01");
    expect(expired?.current).toBe(false);
    expect(roleStanding(false)).toBe("Not current on this date");
    expect(roleStanding(true)).toBe("Current on this date");

    const bm = lookupByCode(snapshot, "BM_UNIT_ID", "2__ANPOW000", ON);
    expect(bm.matches).toHaveLength(1);
    expect(bm.matches[0]?.organisation?.name).toBe("North Power Limited");
    expect(bm.matches[0]?.identifiers[0]?.current).toBe(false);
    expect(bm.matches[0]?.identifiers[0]?.roles[0]?.current).toBe(false);

    const gsp = lookupByCode(snapshot, "GSP_GROUP", "_A", ON);
    expect(gsp.matches[0]?.organisation).toBeNull();
    expect(gsp.matches[0]?.identifiers[0]?.label).toBe("Eastern");
    expect(lookupByCode(snapshot, "MPID", "_A", ON).matches).toEqual([]);

    const markup = renderToStaticMarkup(
      <LookupResults matches={npow.matches} truncated={false} />,
    );
    expect(markup).toContain(MPID_LABEL);
    expect(markup).toContain(ROLE_LABEL);
    expect(markup).toContain("Valid from 1 Jan 2010 to 1 Jan 2020");
    expect(markup).toContain("Valid from 2 Jan 2020, no end date published");
    expect(markup).toContain("Not current on this date");
    expect(markup.match(/Current on this date/g)?.length).toBeGreaterThan(0);
    const expiredAt = markup.indexOf("Valid from 1 Jan 2010 to 1 Jan 2020");
    const standingAt = markup.indexOf("Not current on this date", expiredAt);
    expect(standingAt).toBeGreaterThan(expiredAt);
    expect(markup.slice(expiredAt, standingAt)).not.toContain("Current on this date");
  });

  it("refuses an unknown column and a full ISD download", () => {
    const extracts = fixtureDirectoryExtracts();
    expect(() =>
      buildDirectory(
        {
          ...extracts,
          organisations: extracts.organisations.replace(
            "ISO Country Code",
            "ISO Country Code,Extra",
          ),
        },
        RECORDED_AT,
      ),
    ).toThrow(/columns changed/);
    for (const filter of ISD_LOOKUP_FILTERS) {
      const url = isdEntityUrl(filter);
      expect(url).toContain(`Filter=${filter}`);
      expect(url).not.toContain("Filter=Full");
      expect(url).not.toContain("Filter=LLF");
    }
    expect(effectiveSentence("2010-01-01", null)).toBe("Valid from 1 Jan 2010, no end date published");
    expect(effectiveSentence("2010-01-01", "2020-01-01")).toBe("Valid from 1 Jan 2010 to 1 Jan 2020");
  });

  it("writes one blob release and skips a second write of the same extract", async () => {
    const extracts = fixtureDirectoryExtracts();
    const store = new MemoryDirectoryStore();
    const fetchText = async (url: string) => {
      const filter = new URL(url).searchParams.get("Filter");
      const body =
        filter === "ISDEntity1"
          ? extracts.organisations
          : filter === "ISDEntity18"
            ? extracts.gspGroups
            : filter === "ISDEntity21"
              ? extracts.marketRoles
              : filter === "ISDEntity45"
                ? extracts.participantRoles
                : extracts.bmUnits;
      return { status: 200, body };
    };
    const first = await ingestDirectory({ now: new Date(RECORDED_AT), fetchText, store });
    expect(first.ok).toBe(true);
    expect(first.unchanged).toBe(false);
    expect(first.quarantined).toBe(2);
    const second = await ingestDirectory({
      now: new Date("2026-10-22T06:15:00.000Z"),
      fetchText,
      store,
    });
    expect(second.unchanged).toBe(true);
    expect(second.releaseId).toBe(first.releaseId);
    expect([...store.files.keys()].filter((path) => path.endsWith(".json")).length).toBe(2);
  });

  it("returns 403 for an export and caps resolve without logging codes", async () => {
    const exported = await exportGet();
    expect(exported.status).toBe(403);
    expect(await exported.json()).toEqual({ error: REDISTRIBUTION_NOT_PERMITTED });
    expect((await exportPost()).status).toBe(403);

    const blocked = await lookupGet(
      new Request("http://localhost/api/v1/identifiers?scheme=MPID&code=NPOW&effective_on=2026-10-15&export=1"),
    );
    expect(blocked.status).toBe(403);

    const lookup = await lookupGet(
      new Request("http://localhost/api/v1/identifiers?scheme=MPID&code=NPOW&effective_on=2026-10-15"),
    );
    expect(lookup.status).toBe(200);
    const body = (await lookup.json()) as { matches: Array<{ identifiers: Array<{ roles: Array<{ current: boolean; effective_to: string | null }> }> }> };
    const expired = body.matches
      .flatMap((match) => match.identifiers)
      .flatMap((identifier) => identifier.roles)
      .find((role) => role.effective_to === "2020-01-01");
    expect(expired?.current).toBe(false);

    const tooMany = parseResolveBody({
      effective_on: ON,
      queries: Array.from({ length: 21 }, () => ({ scheme: "MPID", code: "NPOW" })),
    });
    expect(tooMany.ok).toBe(false);
    if (!tooMany.ok) {
      expect(tooMany.status).toBe(400);
    }

    const resolve = await resolvePost(
      new Request("http://localhost/api/v1/identifiers/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          effective_on: ON,
          queries: [{ scheme: "MPID", code: "NPOW" }],
        }),
      }),
    );
    expect(resolve.status).toBe(200);
    expect(resolveLogFields(1)).toEqual({ count: 1 });
    const route = readFileSync(resolvePath(process.cwd(), "src/app/api/v1/identifiers/resolve/route.ts"), "utf8");
    expect(route).toContain("resolveLogFields");
    expect(route).not.toContain("console.info(\"[identifiers] resolve\", parsed");
    expect(route).not.toContain("console.info(body");
    expect(route).not.toContain("query.code");
  });
});
