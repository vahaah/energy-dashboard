import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots.txt", () => {
  it("allows the site, blocks /api/, and points at the sitemap", () => {
    const result = robots();
    expect(result.rules).toEqual([{ userAgent: "*", allow: "/", disallow: ["/api/"] }]);
    expect(result.sitemap).toBe("https://grid.vahaah.com/sitemap.xml");
    expect(result.host).toBe("https://grid.vahaah.com");
  });
});
