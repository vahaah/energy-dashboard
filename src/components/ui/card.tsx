import type { ReactNode } from "react";
import { DataStateNotice } from "@/components/ui/data-state";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Skeleton } from "@/components/ui/skeleton";

/** Responsive card inset. 1rem, then 1.5rem from 640px. See `--card-pad`. */
export const CARD_PAD_X = "px-[var(--card-pad)]";
export const CARD_PAD_X_FROM_LG = "lg:px-[var(--card-pad)]";
export const CARD_PAD_RIGHT_FROM_LG = "lg:pr-[var(--card-pad)]";
export const CARD_PAD_TOP = "pt-[var(--card-pad)]";
export const CARD_PAD_BOTTOM = "pb-[var(--card-pad)]";
export const CARD_PAD = "p-[var(--card-pad)]";

export const PAGE_STACK_CLASS = `relative mx-auto flex w-full min-w-0 max-w-[1200px] flex-col gap-4 overflow-x-clip ${CARD_PAD_X} py-6 sm:py-10`;

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
  /** Stat labels are not section headings. */
  titleAs?: "h2" | "h3" | "p";
  as?: "section" | "article" | "div";
  className?: string;
  flush?: boolean;
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

function CardTitle({
  as,
  className,
  children,
}: {
  as: "h2" | "h3" | "p";
  className: string;
  children: ReactNode;
}) {
  switch (as) {
    case "h2":
      return <h2 className={className}>{children}</h2>;
    case "h3":
      return <h3 className={className}>{children}</h3>;
    case "p":
      return <p className={className}>{children}</p>;
    default: {
      const exhaustive: never = as;
      return exhaustive;
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
  titleAs = "h2",
  as = "section",
  className = "",
  flush = false,
}: CardProps) {
  const Tag = as;
  const hasHeader = Boolean(title || tooltip || actions);
  if (flush) {
    return (
      <Tag
        id={id}
        data-slot="card"
        data-size={size}
        className={`surface-card flex min-w-0 flex-col scroll-mt-28 ${
          active ? "border-gray-alpha-600" : ""
        } ${className}`.trim()}
      >
        {children}
        {footer ? (
          <div
            data-slot="card-footer"
            className={`border-t border-gray-alpha-400 ${CARD_PAD_X} py-3 text-label-12 text-gray-900`}
          >
            {footer}
          </div>
        ) : null}
      </Tag>
    );
  }

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
          className={`flex flex-col gap-3 ${CARD_PAD_X} ${CARD_PAD_TOP} sm:flex-row sm:items-start sm:justify-between`}
        >
          <div className="flex min-w-0 items-center gap-2">
            {title ? <CardTitle as={titleAs} className={titleClass(size)}>{title}</CardTitle> : null}
            {tooltip ? (
              <InfoTooltip text={tooltip} label={`About ${title ?? "this card"}`} />
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
          hasHeader
            ? `min-w-0 ${CARD_PAD_X} pt-4 ${CARD_PAD_BOTTOM}`
            : `min-w-0 ${CARD_PAD}`
        }
      >
        {children}
      </div>
      {footer ? (
        <div
          data-slot="card-footer"
          className={`border-t border-gray-alpha-400 ${CARD_PAD_X} py-3 text-label-12 text-gray-900`}
        >
          {footer}
        </div>
      ) : null}
    </Tag>
  );
}

export function CardLoading({ className = "" }: { className?: string }) {
  return (
    <div className="flex flex-col gap-3">
      <DataStateNotice state="loading" />
      <Skeleton
        data-slot="card-loading"
        className={`h-[200px] w-full sm:h-[280px] ${className}`.trim()}
      />
    </div>
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
