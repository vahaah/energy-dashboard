import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IntentRecovery, MeterEnquiryLinks } from "@/components/intent-recovery";
import { LiveMixPrompt } from "@/components/live-mix-prompt";
import { NO_METER_NUMBERS } from "@/lib/directory/copy";
import {
  BMRS_URL,
  ECOES_NOT_PUBLIC,
  ELEXON_ISD_URL,
  FIND_MY_SUPPLIER_URL,
  LIVE_MIX_PROMPT,
  METER_ENQUIRY_LINKS,
  MPID_IS_NOT_MPAN,
  NGED_MPAN_URL,
  REPD_EXTRACT_URL,
  TEC_REGISTER_URL,
  UKPN_MPAN_URL,
} from "@/lib/intent/recovery";

describe("wrong-page recovery", () => {
  it("points meter queries at official services and not a Grid lookup", () => {
    const html = renderToStaticMarkup(
      <>
        <IntentRecovery />
        <MeterEnquiryLinks />
      </>,
    );
    expect(html).toContain(NO_METER_NUMBERS);
    expect(html).toContain(MPID_IS_NOT_MPAN);
    expect(html).toContain(ECOES_NOT_PUBLIC);
    expect(html).not.toContain("https://www.ecoes.co.uk");
    expect(html).toContain(FIND_MY_SUPPLIER_URL);
    expect(html).toContain(UKPN_MPAN_URL);
    expect(html).toContain(NGED_MPAN_URL);
    expect(html).toContain(REPD_EXTRACT_URL);
    expect(html).toContain(TEC_REGISTER_URL);
    expect(html).toContain(BMRS_URL);
    expect(html).toContain(ELEXON_ISD_URL);
    expect(html).toContain('href="/tools#ena"');
    expect(html).toContain('href="/pipeline"');
    expect(html).toContain('href="/api"');
    expect(html).not.toContain("<form");
    expect(html).not.toContain("/api/mpan");
    for (const link of METER_ENQUIRY_LINKS) {
      expect(link.href.startsWith("https://")).toBe(true);
    }
    const tools = readFileSync(resolve(process.cwd(), "src/app/tools/page.tsx"), "utf8");
    const sources = readFileSync(resolve(process.cwd(), "src/app/data-sources/page.tsx"), "utf8");
    expect(tools).toContain('id="meter"');
    expect(tools).toContain('id="ena"');
    expect(tools).toContain("Look up a meter, MPAN or MPRN");
    expect(tools).toContain("NO_METER_NUMBERS");
    expect(sources).toContain("IntentRecovery");
    expect(sources).toContain("Looking for something else?");
    expect(sources).not.toContain("queryPipe");
  });

  it("links records and methodology to today", () => {
    const html = renderToStaticMarkup(<LiveMixPrompt />);
    expect(LIVE_MIX_PROMPT).toBe("Looking for the live mix or the wholesale price?");
    expect(html).toContain(LIVE_MIX_PROMPT);
    expect(html).toContain('href="/today"');
    expect(html).toContain(">Today<");
    const records = readFileSync(resolve(process.cwd(), "src/app/records/page.tsx"), "utf8");
    const methodology = readFileSync(resolve(process.cwd(), "src/app/methodology/page.tsx"), "utf8");
    expect(records).toContain("<LiveMixPrompt");
    expect(methodology).toContain("<LiveMixPrompt");
    expect(records).not.toContain("live dashboard");
  });
});
