import { renderOgImageResponse } from "@/lib/og/response";
import { parseOgVariant } from "@/lib/og/model";

export const revalidate = 86_400;

export async function GET(request: Request) {
  const url = new URL(request.url);
  return renderOgImageResponse(
    parseOgVariant({
      focus: url.searchParams.get("focus"),
      page: url.searchParams.get("page"),
    })
  );
}
