import { Card } from "@/components/ui/card";
import { formatVerifiedDay, toolRelationMark, toolSectorLabel, toolTaskLabel, TOOLS_REPORT_BODY, TOOLS_REPORT_TITLE } from "@/lib/tools/copy";
import { TOOL_TASKS, type ToolRecord, type ToolsFile } from "@/lib/tools/schema";

export function ToolsBoard({ file }: { file: ToolsFile }) {
  const groups = TOOL_TASKS.map((task) => ({
    task,
    tools: file.tools.filter((tool) => tool.task === task),
  })).filter((group) => group.tools.length > 0);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {groups.map((group) => (
        <Card key={group.task} title={toolTaskLabel(group.task)}>
          <div className="flex min-w-0 flex-col gap-4">
            {group.tools.map((tool) => (
              <ToolRow key={tool.tool_id} tool={tool} />
            ))}
          </div>
        </Card>
      ))}
      <Card title={TOOLS_REPORT_TITLE}>
        <p className="text-copy-14 text-gray-900">{TOOLS_REPORT_BODY}</p>
        <p className="mt-3 break-words text-copy-14">
          <a
            href={file.report_broken_link.mailto}
            className="text-blue-700 underline-offset-2 hover:underline"
          >
            Email
          </a>
          <span className="text-gray-900"> · </span>
          <a
            href={file.report_broken_link.github_issue}
            className="text-blue-700 underline-offset-2 hover:underline"
          >
            GitHub issue
          </a>
        </p>
      </Card>
    </div>
  );
}

function ToolRow({ tool }: { tool: ToolRecord }) {
  const mark = toolRelationMark(tool.relation);
  return (
    <div className="min-w-0 border-t border-gray-alpha-400 pt-4 first:border-t-0 first:pt-0">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <a href={tool.url} className="min-w-0 break-words text-copy-14 text-blue-700 underline-offset-2 hover:underline">
          {tool.name}
        </a>
        {mark ? <span className="text-label-12 text-gray-900">{mark}</span> : null}
      </div>
      <p className="mt-1 break-words text-copy-14 text-gray-900">{tool.purpose}</p>
      <p className="mt-2 break-words text-label-12 text-gray-900">
        {tool.provider} · {toolSectorLabel(tool.sector)} · {tool.geographic_coverage}
      </p>
      <p className="mt-1 break-words text-label-12 text-gray-900">
        {tool.access}
        {tool.cost ? ` · ${tool.cost}` : ""}
      </p>
      <p className="mt-1 text-label-12 text-gray-900">Verified {formatVerifiedDay(tool.last_verified)}</p>
      <p className="mt-1 break-all text-mono-12 text-gray-900">{tool.url}</p>
    </div>
  );
}
