import clsx from "clsx";
import type { CSSProperties } from "react";

interface SkeletonProps {
  rows?: number;
  height?: number;
  width?: string;
  className?: string;
}

export function Skeleton({ rows = 1, height = 14, width = "100%", className }: SkeletonProps) {
  return (
    <div className={clsx("skeleton-stack", className)} aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <span
          key={index}
          className="skeleton"
          style={
            {
              height,
              width: index === rows - 1 && rows > 1 ? "68%" : width,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
