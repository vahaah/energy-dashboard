import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: "https://grid.vahaah.com/sitemap.xml",
    host: "https://grid.vahaah.com",
  };
}
