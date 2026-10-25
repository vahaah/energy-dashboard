import { Card } from "@/components/ui/card";
import { formatVerifiedDay, toolRelationMark, toolTaskLabel, TOOLS_REPORT_BODY, TOOLS_REPORT_TITLE } from "@/lib/tools/copy";
import { TOOL_TASKS, type ToolRecord, type ToolsFile } from "@/lib/tools/schema";

export function ToolsBoard({ file }: { file: ToolsFile }) {
  const groups = TOOL_TASKS.map((task) => ({
    task,
    tools: file.tools.filter((tool) => tool.task === task),
  })).filter((group) => group.tools.length > 0);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <nav aria-label="Tasks" className="flex flex-wrap gap-x-4 gap-y-2 text-copy-14">
        {groups.map((group) => (
          <a key={group.task} href={`#${group.task}`} className="text-blue-700 underline-offset-2 hover:underline">
            {toolTaskLabel(group.task)}
          </a>
        ))}
      </nav>
      {groups.map((group) => (
        <Card key={group.task} id={group.task} title={toolTaskLabel(group.task)} footer={<p>Verified {sectionVerified(group.tools)}</p>}>
          <div className="flex min-w-0 flex-col">
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
  const external = tool.relation === "links_out";
  const domain = toolDomain(tool.url);
  return (
    <div className="min-w-0 border-t border-gray-alpha-400 py-3 first:border-t-0 first:pt-0">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <a
          href={tool.url}
          className="min-w-0 break-words text-copy-14 text-blue-700 underline-offset-2 hover:underline"
          {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
          aria-label={external ? `${tool.name}, opens external site` : tool.name}
        >
          {tool.name}
          {external ? <span aria-hidden="true"> ↗</span> : null}
        </a>
        {mark ? <span className="text-label-13 text-gray-900">{mark}</span> : null}
        <span className="text-label-13 text-gray-900">{domain}</span>
      </div>
      <p className="mt-1 break-words text-copy-14 text-gray-900">{tool.purpose}</p>
    </div>
  );
}

function sectionVerified(tools: readonly ToolRecord[]): string {
  const days = [...new Set(tools.map((tool) => tool.last_verified))].sort();
  const latest = days[days.length - 1] ?? "";
  return formatVerifiedDay(latest);
}

function toolDomain(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
