import type { ReactNode } from "react";
import { InfoTooltip } from "@/components/ui/info-tooltip";

export function SectionBlock({
  id,
  title,
  tooltip,
  headerRight,
  children,
  active = false,
}: {
  id?: string;
  title: string;
  tooltip?: string;
  headerRight?: ReactNode;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <section
      id={id}
      className={`surface-card scroll-mt-28 p-4 sm:p-6 ${
        active ? "border-gray-alpha-600" : ""
      }`}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-heading-24 text-gray-1000">{title}</h2>
          {tooltip ? <InfoTooltip text={tooltip} label={`What is ${title}?`} /> : null}
        </div>
        {headerRight}
      </div>
      {children}
    </section>
  );
}
