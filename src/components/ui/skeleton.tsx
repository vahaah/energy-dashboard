import type { HTMLAttributes } from "react";

export function Skeleton({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="skeleton"
      className={`animate-pulse motion-reduce:animate-none rounded-md bg-white/[0.08] ${className}`}
      {...props}
    />
  );
}
