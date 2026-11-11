import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    // /api/v1/balancing stays under Disallow: /api/, the same as the other /api/v1 routes.
    rules: [{ userAgent: "*", allow: ["/", "/api/snapshots"], disallow: ["/api/"] }],
    sitemap: "https://grid.vahaah.com/sitemap.xml",
  };
}
