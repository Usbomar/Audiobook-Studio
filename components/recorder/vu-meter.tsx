"use client";

import { cn } from "@/lib/utils";

const BAR_COUNT = 24;

export function VuMeter({
  level,
  className,
}: {
  level: number;
  className?: string;
}) {
  const clamped = Math.min(1, Math.max(0, level));

  return (
    <div
      className={cn("flex h-10 items-end justify-center gap-0.5", className)}
      role="meter"
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Nivell d'àudio"
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => {
        const threshold = (i + 1) / BAR_COUNT;
        const active = clamped >= threshold - 0.04;
        const hot = i >= BAR_COUNT * 0.85;
        return (
          <div
            key={i}
            className={cn(
              "w-1.5 rounded-sm transition-[height,background-color] duration-75",
              active
                ? hot
                  ? "bg-red-500"
                  : "bg-sky-500"
                : "bg-muted"
            )}
            style={{ height: `${((i + 1) / BAR_COUNT) * 100}%` }}
          />
        );
      })}
    </div>
  );
}
