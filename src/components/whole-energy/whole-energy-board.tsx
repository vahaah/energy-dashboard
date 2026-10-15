import { SectorSwitch } from "@/components/whole-energy/sector-switch";
import { Card } from "@/components/ui/card";
import {
  WHOLE_ENERGY_ATTRIBUTION,
  WHOLE_ENERGY_CONVERSION_NOTE,
  WHOLE_ENERGY_DIFFERENCE_NOTE,
  WHOLE_ENERGY_FLOW_LABEL,
  WHOLE_ENERGY_FLOW_URL,
  WHOLE_ENERGY_SCOPE,
  WHOLE_ENERGY_SOURCE,
  WHOLE_ENERGY_STOCK_NOTE,
  WHOLE_ENERGY_TABLE_URL,
  WHOLE_ENERGY_TRANSFORMATION_NOTE,
  wholeEnergyUnitLabel,
} from "@/lib/whole-energy/copy";
import type { WholeEnergyPageModel } from "@/lib/whole-energy/model";
import { COLUMN_LABEL, BALANCE_COLUMNS } from "@/lib/whole-energy/spec";

export function WholeEnergyBoard({ model }: { model: WholeEnergyPageModel }) {
  const unit = wholeEnergyUnitLabel(model.year);
  return (
    <div className="flex flex-col gap-4" data-geography={model.geography}>
      <Card title={WHOLE_ENERGY_FLOW_LABEL} footer={<p>{WHOLE_ENERGY_ATTRIBUTION}</p>}>
        <p className="text-copy-14 text-gray-900">{unit}</p>
        <p className="mt-1 text-label-12 text-gray-900">{WHOLE_ENERGY_SCOPE}</p>
        <ol className="mt-4 grid gap-4 md:grid-cols-3">
          {model.path.map((node, index) => (
            <li key={node.id} className="min-w-0" data-node={node.id}>
              <p className="text-label-12 text-gray-900">{index + 1}</p>
              <h3 className="mt-1 text-heading-16 text-gray-1000">{node.label}</h3>
              <p data-figure className="mt-2 whitespace-nowrap font-sans text-heading-24 tabular-nums text-gray-1000">
                <span data-value>{node.text}</span>
                <span data-unit="TWh" className="ml-2 align-baseline text-copy-14 text-gray-900">
                  TWh
                </span>
              </p>
              <p className="mt-1 break-words text-copy-14 text-gray-900" data-share-base={node.shareBase}>
                {node.shareText}
              </p>
              <p className="mt-2 break-words text-copy-14 text-gray-900">{node.detail}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 break-words text-copy-14 text-gray-900">{WHOLE_ENERGY_TRANSFORMATION_NOTE}</p>
      </Card>

      <Card title="Energy balance">
        <p className="text-copy-14 text-gray-900">{unit}</p>
        <div className="mt-4 min-w-0 max-w-full overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-copy-14">
            <caption className="sr-only">
              {WHOLE_ENERGY_FLOW_LABEL}. {unit} {WHOLE_ENERGY_SCOPE}
            </caption>
            <thead>
              <tr className="border-b border-gray-alpha-400 text-label-12 text-gray-900">
                <th scope="col" className="py-2 pr-3 font-normal">
                  Flow
                </th>
                {BALANCE_COLUMNS.map((column) => (
                  <th key={column} scope="col" className="px-2 py-2 text-right font-normal whitespace-nowrap">
                    {COLUMN_LABEL[column]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-alpha-400" data-balance-row={row.id}>
                  <th
                    scope="row"
                    className={`py-2 pr-3 align-top font-normal ${row.depth === 1 ? "pl-4" : ""} ${
                      row.emphasis ? "text-gray-1000" : "text-gray-900"
                    }`}
                  >
                    {row.label}
                    {row.includedIn ? (
                      <span className="mt-0.5 block text-label-12 text-gray-900">Included in {row.includedIn}.</span>
                    ) : null}
                  </th>
                  {row.cells.map((cell) => (
                    <td key={cell.column} className="px-2 py-2 text-right whitespace-nowrap tabular-nums text-gray-1000">
                      {cell.text}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 break-words text-label-12 text-gray-900">{WHOLE_ENERGY_DIFFERENCE_NOTE}</p>
        <p className="mt-1 break-words text-label-12 text-gray-900">{WHOLE_ENERGY_STOCK_NOTE}</p>
        <p className="mt-1 break-words text-label-12 text-gray-900">{WHOLE_ENERGY_CONVERSION_NOTE}</p>
      </Card>

      <Card title="Final consumption">
        <SectorSwitch sectors={model.sectors} />
        <p className="mt-4 break-words text-copy-14 text-gray-900">
          {WHOLE_ENERGY_SOURCE}{" "}
          <a href={WHOLE_ENERGY_TABLE_URL} className="text-blue-700 underline-offset-2 hover:underline">
            DUKES table 1.1
          </a>
          .{" "}
          <a href={WHOLE_ENERGY_FLOW_URL} className="text-blue-700 underline-offset-2 hover:underline">
            Energy flow chart 2025
          </a>
          .
        </p>
      </Card>
    </div>
  );
}
