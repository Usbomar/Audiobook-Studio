"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Block } from "@/store/types";
import { StatusDot } from "./status-dot";

interface SortableBlockItemProps {
  block: Block;
  projectId: string;
  isActive: boolean;
  onDelete?: (block: Block) => void;
}

export function SortableBlockItem({
  block,
  projectId,
  isActive,
  onDelete,
}: SortableBlockItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: block.id,
    data: { type: "block" as const, projectId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "z-10 opacity-60")}
    >
      <Link
        href={`/studio/${projectId}/${block.id}`}
        className={cn(
          "group flex items-center gap-2 rounded-md py-1.5 pr-2 pl-1 text-sm transition-colors",
          isActive
            ? "bg-sky-100 text-sky-900"
            : "text-foreground/80 hover:bg-muted/60"
        )}
      >
        <button
          type="button"
          className="cursor-grab touch-none p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          aria-label="Arrossegar capítol"
          {...attributes}
          {...listeners}
          onClick={(e) => e.preventDefault()}
        >
          <GripVertical className="size-3.5" />
        </button>
        <StatusDot status={block.status} />
        <span className="min-w-0 flex-1 truncate">{block.title}</span>
        {onDelete && (
          <button
            type="button"
            className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            aria-label={`Esborrar ${block.title}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(block);
            }}
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </Link>
    </div>
  );
}
