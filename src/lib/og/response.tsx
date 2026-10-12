import { ImageResponse } from "next/og";
import { OgImage } from "@/lib/og/image";
import { loadOgFonts } from "@/lib/og/fonts";
import { buildOgCard, ogCacheControl, type OgVariant } from "@/lib/og/model";
import { peekOgCacheSnapshot, type OgCacheSnapshot } from "@/lib/og/peek";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@/lib/site";

export async function renderOgImageResponse(
  variant: OgVariant,
  snapshot?: OgCacheSnapshot
): Promise<ImageResponse> {
  const card = buildOgCard(variant, snapshot ?? (await peekOgCacheSnapshot()));
  const fonts = await loadOgFonts();
  const cacheControl = ogCacheControl(variant);

  return new ImageResponse(<OgImage card={card} />, {
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    fonts,
    headers: {
      "Cache-Control": cacheControl,
      "CDN-Cache-Control": cacheControl,
      "Vercel-CDN-Cache-Control": cacheControl,
    },
  });
}
