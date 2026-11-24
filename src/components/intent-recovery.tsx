import type { ReactNode } from "react";
import Link from "next/link";
import { NO_METER_NUMBERS } from "@/lib/directory/copy";
import {
  BMRS_URL,
  ECOES_NOT_PUBLIC,
  ELEXON_ISD_URL,
  METER_ENQUIRY_LINKS,
  METER_HOLDS_NOTHING,
  METER_SERIAL_LINE,
  MPID_IS_NOT_MPAN,
  OTHER_NETWORK_LINE,
  REPD_EXTRACT_URL,
  TEC_REGISTER_URL,
  type RecoveryLink,
} from "@/lib/intent/recovery";

const linkClass = "text-blue-700 underline-offset-2 hover:underline";

function LinkList({ links }: { links: readonly RecoveryLink[] }) {
  return (
    <ul className="mt-2 space-y-2">
      {links.map((link) => {
        const external = link.href.startsWith("https://");
        return (
          <li key={link.href}>
            {external ? (
              <a href={link.href} className={linkClass}>
                {link.label}
              </a>
            ) : (
              <Link href={link.href} className={linkClass}>
                {link.label}
              </Link>
            )}
            {link.note ? <span className="text-gray-900">. {link.note}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="rounded-xl border border-gray-alpha-400 bg-background-100 p-4">
      <h3 className="text-heading-16 text-gray-1000">{title}</h3>
      <div className="mt-2 space-y-2 text-copy-14 text-gray-900">{children}</div>
    </li>
  );
}

export function MeterEnquiryLinks() {
  return <LinkList links={METER_ENQUIRY_LINKS} />;
}

export function IntentRecovery() {
  return (
    <ul className="grid gap-3">
      <Box title="A meter number, MPAN, MPRN or meter serial">
        <p>
          {NO_METER_NUMBERS} {METER_HOLDS_NOTHING} {MPID_IS_NOT_MPAN} {METER_SERIAL_LINE} {ECOES_NOT_PUBLIC}
        </p>
        <MeterEnquiryLinks />
        <p>{OTHER_NETWORK_LINE}</p>
        <p>
          The same links are on{" "}
          <Link href="/tools#meter" className={linkClass}>
            Tools
          </Link>
          .
        </p>
      </Box>
      <Box title="The ENA search tool">
        <p>The network-operator search, power cuts and the gas emergency number are on Tools. Grid links out.</p>
        <LinkList
          links={[
            {
              href: "/tools#ena",
              label: "Energy Networks Association search tools",
              note: "",
            },
          ]}
        />
      </Box>
      <Box title="Grid capacity or a connection">
        <p>Pipeline is the planning queue. Constraints is published constraint cost and volume, not a connection offer.</p>
        <LinkList
          links={[
            { href: "/pipeline", label: "Pipeline", note: "" },
            { href: "/system/constraints", label: "Constraints", note: "" },
            { href: TEC_REGISTER_URL, label: "NESO TEC register", note: "The transmission connection list." },
          ]}
        />
      </Box>
      <Box title="The Renewable Energy Planning Database">
        <p>Pipeline and Projects read the DESNZ quarterly extract.</p>
        <LinkList
          links={[
            { href: "/pipeline", label: "Pipeline", note: "" },
            { href: "/projects", label: "Projects", note: "" },
            { href: REPD_EXTRACT_URL, label: "DESNZ Renewable Energy Planning Database", note: "The official quarterly extract." },
          ]}
        />
      </Box>
      <Box title="Market data or electricity data flows">
        <p>
          The API is Grid&apos;s published figures. The directory looks up an MPID, BM Unit ID or GSP group. It is not a
          meter database.
        </p>
        <LinkList
          links={[
            { href: "/api", label: "API", note: "" },
            { href: "/directory", label: "Directory", note: "" },
            { href: "/directory/identifiers", label: "MPID, BM Unit ID and GSP", note: "" },
            { href: BMRS_URL, label: "Elexon BMRS", note: "" },
            { href: ELEXON_ISD_URL, label: "Elexon Industry Standing Data", note: "" },
          ]}
        />
      </Box>
    </ul>
  );
}
