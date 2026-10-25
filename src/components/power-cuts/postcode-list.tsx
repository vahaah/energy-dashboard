import { postcodePreview } from "@/lib/power-cuts/dno-shade";

export function PostcodeList({ postcodes }: { postcodes: readonly string[] }) {
  if (postcodes.length === 0) {
    return null;
  }
  const preview = postcodePreview(postcodes);
  const label = preview.count === 1 ? "1 postcode" : `${preview.count} postcodes`;
  return (
    <details className="mt-1 text-copy-14 text-gray-900">
      <summary className="inline-flex min-h-6 cursor-pointer items-center text-blue-700">{label}</summary>
      <p className="mt-1 break-words">
        {preview.shown.join(", ")}
        {preview.rest > 0 ? ` and ${preview.rest} more` : ""}
      </p>
    </details>
  );
}
