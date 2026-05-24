import { cn } from "@/lib/utils";
import type { BlockStatus } from "@/store/types";

const statusStyles: Record<BlockStatus, string> = {
  empty: "border-2 border-dashed border-muted-foreground/40 bg-transparent",
  recorded: "bg-sky-500",
  edited: "bg-amber-500",
  exported: "bg-emerald-500",
};

const statusLabels: Record<BlockStatus, string> = {
  empty: "Pendent",
  recorded: "Gravat",
  edited: "Editat",
  exported: "Exportat",
};

export function StatusDot({
  status,
  className,
}: {
  status: BlockStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-full",
        statusStyles[status],
        className
      )}
      title={statusLabels[status]}
      aria-label={statusLabels[status]}
    />
  );
}
