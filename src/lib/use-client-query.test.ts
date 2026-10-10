import { describe, expect, it } from "vitest";
import { visibleClientQueryData } from "@/lib/use-client-query";

describe("visibleClientQueryData", () => {
  it("keeps the previous value only while the new key is in flight", () => {
    expect(visibleClientQueryData(undefined, "day")).toBe("day");
    expect(
      visibleClientQueryData(
        { data: undefined, error: undefined, promise: Promise.resolve("week") },
        "day"
      )
    ).toBe("day");
  });

  it("drops previous-key data once the replacement query fails", () => {
    expect(
      visibleClientQueryData(
        { data: undefined, error: new Error("week failed"), promise: undefined },
        "day"
      )
    ).toBeUndefined();
  });

  it("keeps same-key data when a refresh of that key fails", () => {
    expect(
      visibleClientQueryData(
        { data: "week", error: new Error("refresh failed"), promise: undefined },
        "week"
      )
    ).toBe("week");
  });
});
