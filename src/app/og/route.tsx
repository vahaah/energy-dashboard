import { renderOgImageResponse } from "@/lib/og/response";
import { parseOgVariant } from "@/lib/og/model";

export const revalidate = 86_400;

export async function GET(request: Request) {
  const url = new URL(request.url);
  // `p` versions the social cache for one settlement period. It is not a
  // historical lookup: the image still reads the latest Redis snapshot.
  // `v` versions the price-cap card when the published figure changes.
  void url.searchParams.get("p");
  void url.searchParams.get("v");
  return renderOgImageResponse(
    parseOgVariant({
      focus: url.searchParams.get("focus"),
      page: url.searchParams.get("page"),
    })
  );
}
