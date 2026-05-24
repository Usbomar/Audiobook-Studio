"use client";

import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Layers,
  Plus,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Block, Project } from "@/store/types";
import { getBlocksForProject, getProjectSummary } from "@/store";
import { Button } from "@/components/ui/button";
import { SortableBlockItem } from "./sortable-block-item";

interface SortableProjectItemProps {
  project: Project;
  blocks: Block[];
  isExpanded: boolean;
  isActiveProject: boolean;
  activeBlockId: string | null;
  onToggle: () => void;
  onAddBlock: () => void;
  onDeleteBlock?: (block: Block) => void;
  onImportAudio?: (projectId: string, file: File) => void;
}

export function SortableProjectItem({
  project,
  blocks,
  isExpanded,
  isActiveProject,
  activeBlockId,
  onToggle,
  onAddBlock,
  onDeleteBlock,
  onImportAudio,
}: SortableProjectItemProps) {
  const importInputRef = useRef<HTMLInputElement>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: project.id,
    data: { type: "project" as const },
  });

  const projectBlocks = getBlocksForProject(blocks, project.id);
  const summary = getProjectSummary(blocks, project.id);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("rounded-lg", isDragging && "z-10 opacity-60")}
    >
      <div
        className={cn(
          "flex items-start gap-0.5 rounded-lg px-1 py-1",
          isActiveProject && !isExpanded && "bg-muted/50"
        )}
      >
        <button
          type="button"
          className="mt-0.5 cursor-grab touch-none p-0.5 text-muted-foreground active:cursor-grabbing"
          aria-label="Arrossegar projecte"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="mt-0.5 shrink-0 text-muted-foreground"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Replegar" : "Desplegar"}
        >
          {isExpanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate text-sm font-medium leading-tight">
            {project.title}
          </p>
          <p className="text-xs text-muted-foreground">
            {summary.total} capítols · {summary.exported} exportats
          </p>
        </button>
      </div>

      {isExpanded && (
        <div className="ml-5 space-y-0.5 border-l border-border/60 pl-2 pb-1">
          <SortableContext
            items={projectBlocks.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            {projectBlocks.map((block) => (
              <SortableBlockItem
                key={block.id}
                block={block}
                projectId={project.id}
                isActive={activeBlockId === block.id}
                onDelete={onDeleteBlock}
              />
            ))}
          </SortableContext>
          <Link
            href={`/studio/${project.id}/assemble`}
            className="flex h-7 w-full items-center gap-1.5 rounded-md px-1 text-xs text-sky-800 hover:bg-muted/60"
          >
            <Layers className="size-3.5" />
            Muntatge
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-full justify-start gap-1.5 px-1 text-xs text-muted-foreground"
            onClick={onAddBlock}
          >
            <Plus className="size-3.5" />
            Afegir capítol
          </Button>
          {onImportAudio && (
            <>
              <input
                ref={importInputRef}
                type="file"
                accept="audio/*,.wav,.mp3,.webm,.ogg,.m4a,.aac,.flac"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportAudio(project.id, file);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-full justify-start gap-1.5 px-1 text-xs text-muted-foreground"
                onClick={() => importInputRef.current?.click()}
              >
                <Upload className="size-3.5" />
                Importar àudio
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
