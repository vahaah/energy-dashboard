import type { ReactNode } from "react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Skeleton } from "@/components/ui/skeleton";

/** Responsive card inset. 1rem, then 1.5rem from 640px. See `--card-pad`. */
export const CARD_PAD_X = "px-[var(--card-pad)]";
export const CARD_PAD_X_FROM_SM = "sm:px-[var(--card-pad)]";
export const CARD_PAD_RIGHT_FROM_SM = "sm:pr-[var(--card-pad)]";
export const CARD_PAD_TOP = "pt-[var(--card-pad)]";
export const CARD_PAD_BOTTOM = "pb-[var(--card-pad)]";
export const CARD_PAD = "p-[var(--card-pad)]";

export const PAGE_STACK_CLASS = `mx-auto flex w-full min-w-0 max-w-[1200px] flex-col gap-4 overflow-x-clip ${CARD_PAD_X} py-6 sm:py-10`;

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
