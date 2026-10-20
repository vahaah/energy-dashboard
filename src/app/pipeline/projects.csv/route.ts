import { pipelineCsv } from "@/lib/pipeline/csv";
import { loadPipelineCatalogue } from "@/lib/pipeline/load";

export const dynamic = "force-static";
export const revalidate = 86400;

export function GET() {
  const { figures } = loadPipelineCatalogue();
  return new Response(pipelineCsv(figures.table), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="gb-renewable-storage-pipeline.csv"',
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
