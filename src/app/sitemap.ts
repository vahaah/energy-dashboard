import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://grid.vahaah.com",
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: "https://grid.vahaah.com/records",
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];
}
