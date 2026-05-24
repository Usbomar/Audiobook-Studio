"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Block, BlockStatus } from "@/store/types";
import { StatusDot } from "@/components/sidebar/status-dot";

const statusLabels: Record<BlockStatus, string> = {
  empty: "Pendent",
  recorded: "Gravat",
  edited: "Editat",
  exported: "Exportat",
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

interface AssembleBlockRowProps {
  block: Block;
  included: boolean;
  onToggle: (included: boolean) => void;
}

export function AssembleBlockRow({
  block,
  included,
  onToggle,
}: AssembleBlockRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border/60 bg-white px-3 py-3 shadow-sm",
        isDragging && "z-10 opacity-60",
        !included && "opacity-60"
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        aria-label="Arrossegar capítol"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <input
        type="checkbox"
        checked={included}
        onChange={(e) => onToggle(e.target.checked)}
        className="size-4 rounded border-border"
        aria-label={`Incloure ${block.title}`}
      />

      <StatusDot status={block.status} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{block.title}</p>
        <p className="text-xs text-muted-foreground">
          {formatDuration(block.durationSeconds)}
        </p>
      </div>

      <Badge variant="secondary">{statusLabels[block.status]}</Badge>
    </div>
  );
}
