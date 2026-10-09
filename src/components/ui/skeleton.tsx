import type { HTMLAttributes } from "react";

export function Skeleton({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="skeleton"
      className={`animate-pulse motion-reduce:animate-none rounded-md bg-gray-alpha-200 ${className}`}
      {...props}
    />
  );
}
