import type { NextConfig } from "next";
import { API_CDN_VARY, EDGE_CACHEABLE_API_PATHS } from "./src/lib/edge-cacheable-api";

const nextConfig: NextConfig = {
  async headers() {
    return EDGE_CACHEABLE_API_PATHS.map((source) => ({
      source,
      headers: [{ key: "Vary", value: API_CDN_VARY }],
    }));
  },
};

export default nextConfig;
