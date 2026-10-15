import { projectPath } from "@/lib/projects/href";

export type ProjectIdentity = {
  project_id: string;
  name: string;
};

export type ProjectRouteDecision =
  | { status: 200; location: string }
  | { status: 308; location: string }
  | { status: 404 };

export function resolveProjectRoute(
  id: string,
  slug: string | undefined,
  projects: readonly ProjectIdentity[],
): ProjectRouteDecision {
  const project = projects.find((item) => item.project_id === id);
  if (!project) {
    return { status: 404 };
  }
  const location = projectPath(project.project_id, project.name);
  const requested = slug === undefined ? `/projects/${id}` : `/projects/${id}/${slug}`;
  if (requested !== location) {
    return { status: 308, location };
  }
  return { status: 200, location };
}
