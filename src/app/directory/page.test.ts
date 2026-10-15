import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DIRECTORY_H1, DIRECTORY_STANDFIRST, DIRECTORY_TITLE, IDENTIFIERS_H1, IDENTIFIERS_STANDFIRST, IDENTIFIERS_TITLE, MPID_LABEL, ROLE_LABEL } from "@/lib/directory/copy";

describe("directory pages", () => {
  it("stays static and leaves the homepage on its 300s budget", () => {
    const directory = readFileSync(resolve(import.meta.dirname, "./page.tsx"), "utf8");
    const identifiers = readFileSync(resolve(import.meta.dirname, "./identifiers/page.tsx"), "utf8");
    const home = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(directory).toContain('export const dynamic = "force-static"');
    expect(directory).toContain("export const revalidate = 86_400");
    expect(directory).toContain("DIRECTORY_TITLE");
    expect(directory).toContain("DIRECTORY_H1");
    expect(directory).toContain("DIRECTORY_STANDFIRST");
    expect(directory).toContain("MPID_LABEL");
    expect(directory).toContain("ROLE_LABEL");
    expect(DIRECTORY_TITLE).toBe("Energy organisations and codes | Grid");
    expect(DIRECTORY_H1).toBe("Who is behind this name or code?");
    expect(DIRECTORY_STANDFIRST).toBe("Organisations, their identifiers and their published roles, with dates.");
    expect(MPID_LABEL).toBe(
      "Market Participant ID: identifies an organisation in electricity settlement. Not a meter number (MPAN).",
    );
    expect(ROLE_LABEL).toBe("The role the source lists for this identifier between the dates shown.");
    expect(directory).not.toContain("queryPipe");
    expect(directory).not.toContain("fixtureDirectoryReader");
    expect(identifiers).toContain('export const dynamic = "force-static"');
    expect(identifiers).toContain("export const revalidate = 86_400");
    expect(identifiers).toContain("IDENTIFIERS_TITLE");
    expect(identifiers).toContain("IDENTIFIERS_H1");
    expect(identifiers).toContain("IDENTIFIERS_STANDFIRST");
    expect(IDENTIFIERS_TITLE).toBe("Look up an MPID or industry code | Grid");
    expect(IDENTIFIERS_H1).toBe("Which organisation does this code belong to, and when?");
    expect(IDENTIFIERS_STANDFIRST).toBe("Search a code. Choose a date to see what applied then.");
    expect(identifiers).not.toContain("queryPipe");
    expect(home).toContain('export const dynamic = "force-static"');
    expect(home).toContain("export const revalidate = 300");
    expect(home).not.toContain("@/lib/directory/");
    expect(home).not.toContain("queryPipe");
  });
});
