import type { DirectoryPreviewRow } from "@/lib/directory/preview";

export function DirectoryPreviewTable({
  rows,
  caption,
}: {
  rows: readonly DirectoryPreviewRow[];
  caption: string;
}) {
  if (rows.length === 0) {
    return <p className="text-copy-14 text-gray-900">Not yet available.</p>;
  }
  return (
    <div className="relative min-w-0 overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-copy-14">
        <caption className="sr-only">{caption}</caption>
        <thead className="text-label-13 text-gray-900">
          <tr>
            <th scope="col" className="pb-2 font-medium">
              Organisation
            </th>
            <th scope="col" className="pb-2 font-medium">
              Scheme
            </th>
            <th scope="col" className="pb-2 font-medium">
              Code
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${index}-${row.scheme}-${row.code}`} className="border-t border-gray-alpha-200">
              <th scope="row" className="py-2 font-medium">
                {row.name}
              </th>
              <td className="py-2">{row.scheme}</td>
              <td className="py-2 tabular-nums">{row.code}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
