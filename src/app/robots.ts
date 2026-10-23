import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/api/snapshots"], disallow: ["/api/"] }],
    sitemap: "https://grid.vahaah.com/sitemap.xml",
  };
}
