import { Dashboard } from "@/components/dashboard";

/**
 * Homepage shell — static/ISR. Range state lives in the URL and is applied
 * client-side so changing Day/Week/Year/All never refetches the RSC tree.
 * Chart data hydrates from cached /api/dashboard and /api/prices.
 */
export const revalidate = 300;
export const dynamic = "force-static";

export default function Home() {
  return <Dashboard />;
}
