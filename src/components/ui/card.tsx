import type { ReactNode } from "react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Skeleton } from "@/components/ui/skeleton";

export const PAGE_STACK_CLASS =
  "mx-auto flex w-full min-w-0 max-w-[1200px] flex-col gap-4 overflow-x-clip px-4 py-6 sm:px-6 sm:py-10";

export const CARD_GRID_CLASS = "grid gap-4 sm:grid-cols-2";

export type CardSize = "default" | "stat";

export type CardProps = {
  id?: string;
  title?: string;
  tooltip?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  active?: boolean;
  size?: CardSize;
  as?: "section" | "article" | "div";
  className?: string;
};

function titleClass(size: CardSize): string {
  switch (size) {
    case "default":
      return "text-heading-16 text-gray-1000";
    case "stat":
      return "text-label-13 text-gray-900";
    default: {
      const _exhaustive: never = size;
      return _exhaustive;
    }
  }
}

export function Card({
  id,
  title,
  tooltip,
  actions,
  footer,
  children,
  active = false,
  size = "default",
  as = "section",
  className = "",
}: CardProps) {
  const Tag = as;
  const hasHeader = Boolean(title || tooltip || actions);

  return (
    <Tag
      id={id}
      data-slot="card"
      data-size={size}
      className={`surface-card flex min-w-0 flex-col scroll-mt-28 ${
        active ? "border-gray-alpha-600" : ""
      } ${className}`.trim()}
    >
      {hasHeader ? (
        <div
          data-slot="card-header"
          className="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:pt-6"
        >
          <div className="flex min-w-0 items-center gap-2">
            {title ? <h2 className={titleClass(size)}>{title}</h2> : null}
            {tooltip ? (
              <InfoTooltip text={tooltip} label={`What is ${title ?? "this"}?`} />
            ) : null}
          </div>
          {actions ? (
            <div data-slot="card-actions" className="flex shrink-0 flex-wrap items-center gap-3">
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}
      <div
        data-slot="card-body"
        className={
          hasHeader ? "min-w-0 px-4 pt-4 pb-4 sm:px-6 sm:pt-4 sm:pb-6" : "min-w-0 p-4 sm:p-6"
        }
      >
        {children}
      </div>
      {footer ? (
        <div
          data-slot="card-footer"
          className="border-t border-gray-alpha-400 px-4 py-3 text-label-12 text-gray-900 sm:px-6"
        >
          {footer}
        </div>
      ) : null}
    </Tag>
  );
}

export function CardLoading({ className = "" }: { className?: string }) {
  return (
    <Skeleton
      data-slot="card-loading"
      className={`h-[200px] w-full sm:h-[280px] ${className}`.trim()}
    />
  );
}

export function CardEmpty({
  children,
  stamp,
}: {
  children?: ReactNode;
  stamp?: string;
}) {
  return (
    <div
      data-slot="card-empty"
      className="flex min-h-40 items-center justify-center text-copy-14 text-gray-900"
    >
      {children ??
        (stamp
          ? `Data is catching up. Last update ${stamp.replace("Data as of ", "")}`
          : "No data")}
    </div>
  );
}

export function CardError({ children }: { children: ReactNode }) {
  return (
    <div
      data-slot="card-error"
      role="alert"
      className="flex min-h-40 items-center justify-center text-copy-14 text-red-700"
    >
      {children}
    </div>
  );
}
