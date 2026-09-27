import { describe, expect, it } from "vitest";
import { isCronAuthorized } from "@/lib/cron-auth";

describe("cron auth", () => {
  it("fails closed when CRON_SECRET is unset", () => {
    expect(isCronAuthorized("Bearer anything", undefined)).toBe(false);
    expect(isCronAuthorized(null, "")).toBe(false);
  });

  it("rejects a missing or mismatched bearer token", () => {
    expect(isCronAuthorized(null, "secret")).toBe(false);
    expect(isCronAuthorized("Bearer other", "secret")).toBe(false);
  });

  it("accepts the matching bearer token", () => {
    expect(isCronAuthorized("Bearer secret", "secret")).toBe(true);
  });
});
