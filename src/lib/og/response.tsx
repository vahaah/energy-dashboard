import { ImageResponse } from "next/og";
import { OgImage } from "@/lib/og/image";
import { loadOgFonts } from "@/lib/og/fonts";
import { buildOgCard, type OgVariant } from "@/lib/og/model";
import { peekOgCacheSnapshot, type OgCacheSnapshot } from "@/lib/og/peek";
import { OG_CACHE_CONTROL, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@/lib/site";

export async function renderOgImageResponse(
  variant: OgVariant,
  snapshot?: OgCacheSnapshot
): Promise<ImageResponse> {
  const card = buildOgCard(variant, snapshot ?? (await peekOgCacheSnapshot()));
  const fonts = await loadOgFonts();

  return new ImageResponse(<OgImage card={card} />, {
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    fonts,
    headers: {
      "Cache-Control": OG_CACHE_CONTROL,
      "CDN-Cache-Control": OG_CACHE_CONTROL,
      "Vercel-CDN-Cache-Control": OG_CACHE_CONTROL,
    },
  });
}
