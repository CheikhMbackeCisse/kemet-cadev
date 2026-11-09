import { cn } from "../../lib/cn.js";

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-control bg-surface-2", className)}
      aria-hidden="true"
    />
  );
}
