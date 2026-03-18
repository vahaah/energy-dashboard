import type { HTMLAttributes } from "react";

export function Skeleton({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="skeleton"
      className={`animate-pulse rounded-md bg-white/[0.08] ${className}`}
      {...props}
    />
  );
}
