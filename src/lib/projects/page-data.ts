import { loadProjectCatalogue } from "@/lib/projects/load";
import {
  PROJECT_LIST_DEFAULT,
  projectCounts,
  projectFacets,
  queryProjectRows,
  type CountRow,
  type ProjectListPage,
} from "@/lib/projects/list";
import { buildProjectsDocument, projectIndexRow, type ProjectsDocument } from "@/lib/projects/page-model";

export type ProjectsPageData = {
  document: Omit<ProjectsDocument, "rows">;
  counts: { stage: CountRow[]; technology: CountRow[]; nation: CountRow[] };
  facets: { stages: string[]; technologies: string[]; nations: string[] };
  list: ProjectListPage;
};

/** Summary, facet lists, and the first page. The register itself stays on the server. */
export function loadProjectsPageData(): ProjectsPageData {
  const rows = loadProjectCatalogue().projects.map(projectIndexRow);
  const document = buildProjectsDocument(loadProjectCatalogue().projects);
  return {
    document: {
      operating: document.operating,
      connection: document.connection,
      storage: document.storage,
      shares: document.shares,
      proposedExcluded: document.proposedExcluded,
    },
    counts: projectCounts(rows),
    facets: projectFacets(rows),
    list: queryProjectRows(rows, PROJECT_LIST_DEFAULT),
  };
}
