import { describe, expect, it } from "vitest";
import { tinybirdReadToken, tinybirdSqlRequestInit, tinybirdSqlToken } from "@/lib/tinybird-sql";

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

  it("POSTs SQL as the q form parameter like backfill-gb-gas-sap", () => {
    const init = tinybirdSqlRequestInit("SELECT 1", { TINYBIRD_TOKEN: "admin-token" });
    const headers = init.headers as Record<string, string>;
    expect(init.method).toBe("POST");
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(headers.Authorization).toBe("Bearer admin-token");
    expect(String(init.body)).toBe(new URLSearchParams({ q: "SELECT 1 FORMAT JSON" }).toString());
  });
});
