import type { OfgemCiCml } from "@/lib/power-cuts/ofgem";
import { OFGEM_CI_CML_ATTRIBUTION } from "@/lib/attribution";
import { TableScroll } from "@/components/ui/table-scroll";

function comparison(value: number, target: number): string {
  return value > target ? "above target" : "within target";
}

function Bar({ value, target, max }: { value: number; target: number; max: number }) {
  const scale = max <= 0 ? 1 : max;
  return (
    <div className="relative h-2 overflow-hidden rounded-full bg-gray-alpha-400">
      <div className="h-full bg-chart-gas" style={{ width: `${Math.min(100, (value / scale) * 100)}%` }} />
      <div
        className="absolute top-0 h-full w-px bg-gray-1000"
        style={{ left: `${Math.min(100, (target / scale) * 100)}%` }}
      />
    </div>
  );
}

export function OfgemContext({ data }: { data: OfgemCiCml }) {
  const ciMax = Math.max(...data.rows.flatMap((row) => [row.ci, row.ci_target]));
  const cmlMax = Math.max(...data.rows.flatMap((row) => [row.cml, row.cml_target]));
  return (
    <section aria-labelledby="ofgem-context">
      <h2 id="ofgem-context" className="text-heading-24 text-gray-1000">
        Interruptions and minutes lost, {data.year}
      </h2>
      <p className="mt-2 max-w-3xl text-copy-14 text-gray-900">
        Ofgem RIIO-ED2 annual figures, in minutes. A higher number is worse. The mark on each bar is that
        operator&apos;s target. {data.note}
      </p>
      <TableScroll className="mt-4">
        <table className="w-full min-w-[44rem] border-collapse text-left text-copy-14">
          <thead>
            <tr className="text-label-13 text-gray-900">
              <th className="py-2 pr-3 font-medium">Network</th>
              <th className="py-2 pr-3 font-medium">CI</th>
              <th className="py-2 pr-3 font-medium">CI target</th>
              <th className="py-2 pr-3 font-medium">CML</th>
              <th className="py-2 pr-3 font-medium">CML target</th>
              <th className="py-2 font-medium">Against target</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.label} className="border-t border-gray-alpha-400">
                <th scope="row" className="py-3 pr-3 text-left font-medium text-gray-1000">
                  {row.name}
                  <span className="mt-1 block text-label-12 font-normal text-gray-900">{row.label}</span>
                </th>
                <td className="py-3 pr-3 tabular-nums">
                  <div>{row.ci.toFixed(2)}</div>
                  <Bar value={row.ci} target={row.ci_target} max={ciMax} />
                </td>
                <td className="py-3 pr-3 tabular-nums">{row.ci_target.toFixed(2)}</td>
                <td className="py-3 pr-3 tabular-nums">
                  <div>{row.cml.toFixed(2)}</div>
                  <Bar value={row.cml} target={row.cml_target} max={cmlMax} />
                </td>
                <td className="py-3 pr-3 tabular-nums">{row.cml_target.toFixed(2)}</td>
                <td className="py-3 text-gray-900">
                  CI {comparison(row.ci, row.ci_target)}. CML {comparison(row.cml, row.cml_target)}.
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      <p className="mt-3 text-copy-14 text-gray-900">
        <a className="text-blue-700 underline-offset-2 hover:underline" href={data.page_url}>
          {OFGEM_CI_CML_ATTRIBUTION}
        </a>
      </p>
    </section>
  );
}
