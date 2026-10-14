import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";
import { API_CDN_VARY, EDGE_CACHEABLE_API_PATHS } from "./src/lib/edge-cacheable-api";
import {
  PLAUSIBLE_EVENT_PATH,
  PLAUSIBLE_SCRIPT_PATH,
  PLAUSIBLE_UPSTREAM_EVENT,
  PLAUSIBLE_UPSTREAM_SCRIPT,
} from "./src/lib/plausible";

const nextConfig: NextConfig = {
  async headers() {
    return EDGE_CACHEABLE_API_PATHS.map((source) => ({
      source,
      headers: [{ key: "Vary", value: API_CDN_VARY }],
    }));
  },
  // First-party Plausible proxy. No CSP is configured; these paths stay on
  // this origin so a future script-src / connect-src 'self' still works.
  async rewrites() {
    return [
      { source: PLAUSIBLE_SCRIPT_PATH, destination: PLAUSIBLE_UPSTREAM_SCRIPT },
      { source: PLAUSIBLE_EVENT_PATH, destination: PLAUSIBLE_UPSTREAM_EVENT },
    ];
  },
  async redirects() {
    return [
      {
        source: "/attributions",
        destination: "/data-sources",
        permanent: true,
      },
    ];
  },
};

export default withWorkflow(nextConfig);
