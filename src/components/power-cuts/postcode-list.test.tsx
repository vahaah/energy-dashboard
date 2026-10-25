import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PostcodeList } from "@/components/power-cuts/postcode-list";

describe("postcode list", () => {
  it("keeps the page to a count plus five codes", () => {
    const html = renderToStaticMarkup(
      <PostcodeList postcodes={["TW1 1", "TW1 2", "TW1 3", "TW1 4", "TW1 5", "TW1 6", "TW1 7"]} />,
    );
    expect(html).toContain("<details");
    expect(html).toContain("7 postcodes");
    expect(html).toContain("TW1 1, TW1 2, TW1 3, TW1 4, TW1 5");
    expect(html).toContain("and 2 more");
    expect(html).not.toContain("TW1 6");
  });
});
