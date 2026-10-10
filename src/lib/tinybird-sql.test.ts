import { describe, expect, it } from "vitest";
import { tinybirdReadToken, tinybirdSqlToken } from "@/lib/tinybird-sql";

describe("Tinybird script tokens", () => {
  it("lets SQL use the admin token and never sends it to pipes", () => {
    const env = {
      TINYBIRD_TOKEN: "admin-token",
      TINYBIRD_READ_TOKEN: "read-token",
    };
    expect(tinybirdSqlToken(env)).toBe("admin-token");
    expect(tinybirdReadToken(env)).toBe("read-token");
  });

  it("fails closed on pipe queries when the read token is missing", () => {
    expect(() => tinybirdReadToken({ TINYBIRD_TOKEN: "admin-token" })).toThrow(
      "TINYBIRD_READ_TOKEN is not set"
    );
    expect(tinybirdSqlToken({ TINYBIRD_READ_TOKEN: "read-token" })).toBe("read-token");
  });
});
