import { buildPowerCutsOgCard } from "@/lib/power-cuts/og";
import { loadPowerCutsSnapshot } from "@/lib/power-cuts/reader";
import { renderPreparedOgCard } from "@/lib/og/response";

export const revalidate = 300;
export const alt = "Power cuts by area";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CACHE = "public, s-maxage=300, stale-while-revalidate=86400";

export default async function PowerCutsOpenGraphImage() {
  const snapshot = await loadPowerCutsSnapshot();
  return renderPreparedOgCard(buildPowerCutsOgCard(snapshot), CACHE);
}
