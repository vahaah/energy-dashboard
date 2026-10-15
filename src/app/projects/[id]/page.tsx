import { notFound, permanentRedirect } from "next/navigation";
import { loadProjectCatalogue } from "@/lib/projects/load";
import { resolveProjectRoute } from "@/lib/projects/route";

export const dynamic = "force-static";
export const dynamicParams = true;
export const revalidate = 86_400;

export function generateStaticParams(): { id: string }[] {
  return [];
}

export default async function ProjectIdRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const decision = resolveProjectRoute(id, undefined, loadProjectCatalogue().projects);
  if (decision.status === 404) {
    notFound();
  }
  permanentRedirect(decision.location);
}
