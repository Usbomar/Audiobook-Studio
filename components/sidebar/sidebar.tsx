"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Archive, Plus } from "lucide-react";
import { exportProjectBackup } from "@/lib/storage/backup";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getBlocksForProject,
  useStudioStore,
} from "@/store";
import type { Block, Project } from "@/store/types";
import { DeleteBlockDialog } from "@/components/blocks/delete-block-dialog";
import { removeBlockFromStudio } from "@/lib/storage";
import { NewProjectDialog } from "./new-project-dialog";
import { SortableProjectItem } from "./sortable-project-item";
import { StatusDot } from "./status-dot";

export function Sidebar() {
  const router = useRouter();
  const projects = useStudioStore((s) => s.projects);
  const blocks = useStudioStore((s) => s.blocks);
  const activeProjectId = useStudioStore((s) => s.activeProjectId);
  const activeBlockId = useStudioStore((s) => s.activeBlockId);
  const addProject = useStudioStore((s) => s.addProject);
  const addBlock = useStudioStore((s) => s.addBlock);
  const reorderBlocks = useStudioStore((s) => s.reorderBlocks);
  const reorderProjects = useStudioStore((s) => s.reorderProjects);
  const setActiveProject = useStudioStore((s) => s.setActiveProject);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [blockDialogProjectId, setBlockDialogProjectId] = useState<
    string | null
  >(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [blockToDelete, setBlockToDelete] = useState<Block | null>(null);
  const [isDeletingBlock, setIsDeletingBlock] = useState(false);
  const [activeDrag, setActiveDrag] = useState<{
    type: "project" | "block";
    item: Project | Block;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (activeProjectId) {
      setExpandedIds((prev) => new Set(prev).add(activeProjectId));
    }
  }, [activeProjectId]);

  const toggleExpanded = useCallback((projectId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
    setActiveProject(projectId);
  }, [setActiveProject]);

  const handleCreateProject = (title: string) => {
    addProject(title);
  };

  const handleDeleteBlock = async () => {
    if (!blockToDelete) return;
    setIsDeletingBlock(true);
    try {
      const { projectId, id } = blockToDelete;
      await removeBlockFromStudio(id);
      setBlockToDelete(null);

      if (activeBlockId === id) {
        const remaining = getBlocksForProject(
          useStudioStore.getState().blocks,
          projectId
        );
        if (remaining.length > 0) {
          router.push(`/studio/${projectId}/${remaining[0].id}`);
        } else {
          router.push("/");
        }
      }
    } finally {
      setIsDeletingBlock(false);
    }
  };

  const handleCreateBlock = (title: string) => {
    if (!blockDialogProjectId) return;
    const blockId = addBlock(blockDialogProjectId, title);
    setExpandedIds((prev) => new Set(prev).add(blockDialogProjectId));
    router.push(`/studio/${blockDialogProjectId}/${blockId}`);
    setBlockDialogProjectId(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const type = event.active.data.current?.type as "project" | "block";
    if (type === "project") {
      const project = projects.find((p) => p.id === event.active.id);
      if (project) setActiveDrag({ type: "project", item: project });
    } else if (type === "block") {
      const block = blocks.find((b) => b.id === event.active.id);
      if (block) setActiveDrag({ type: "block", item: block });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeType = active.data.current?.type;

    if (activeType === "project") {
      const oldIndex = projects.findIndex((p) => p.id === active.id);
      const newIndex = projects.findIndex((p) => p.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(projects, oldIndex, newIndex);
      reorderProjects(reordered.map((p) => p.id));
      return;
    }

    if (activeType === "block") {
      const projectId = active.data.current?.projectId as string;
      const overProjectId = over.data.current?.projectId as string;
      if (!projectId || projectId !== overProjectId) return;

      const projectBlocks = getBlocksForProject(blocks, projectId);
      const oldIndex = projectBlocks.findIndex((b) => b.id === active.id);
      const newIndex = projectBlocks.findIndex((b) => b.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(projectBlocks, oldIndex, newIndex);
      reorderBlocks(
        projectId,
        reordered.map((b) => b.id)
      );
    }
  };

  return (
    <>
      <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border/60 bg-[#faf8f4]">
        <div className="border-b border-border/60 px-4 py-4">
          <h1 className="text-xs font-semibold tracking-[0.2em] text-muted-foreground">
            AUDIOLLIBRES
          </h1>
        </div>

        <div className="space-y-2 p-3">
          <Button
            className="w-full gap-2"
            onClick={() => setProjectDialogOpen(true)}
          >
            <Plus className="size-4" />
            Nou projecte
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            disabled={isBackingUp || projects.length === 0}
            onClick={() => {
              setIsBackingUp(true);
              void exportProjectBackup(projects, blocks).finally(() =>
                setIsBackingUp(false)
              );
            }}
          >
            <Archive className="size-4" />
            {isBackingUp ? "Creant backup…" : "Backup projecte"}
          </Button>
        </div>

        <ScrollArea className="flex-1 px-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={projects.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1 pb-4">
                {projects.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                    Cap projecte encara. Crea el primer audiollibre.
                  </p>
                ) : (
                  projects.map((project) => (
                    <SortableProjectItem
                      key={project.id}
                      project={project}
                      blocks={blocks}
                      isExpanded={expandedIds.has(project.id)}
                      isActiveProject={activeProjectId === project.id}
                      activeBlockId={activeBlockId}
                      onToggle={() => toggleExpanded(project.id)}
                      onAddBlock={() => setBlockDialogProjectId(project.id)}
                      onDeleteBlock={setBlockToDelete}
                    />
                  ))
                )}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeDrag?.type === "project" && (
                <div className="rounded-lg bg-background px-3 py-2 text-sm shadow-md ring-1 ring-border">
                  {(activeDrag.item as Project).title}
                </div>
              )}
              {activeDrag?.type === "block" && (
                <div className="flex items-center gap-2 rounded-md bg-background px-2 py-1.5 text-sm shadow-md ring-1 ring-border">
                  <StatusDot status={(activeDrag.item as Block).status} />
                  {(activeDrag.item as Block).title}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </ScrollArea>
      </aside>

      <NewProjectDialog
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        onSubmit={handleCreateProject}
      />

      <DeleteBlockDialog
        block={blockToDelete}
        open={blockToDelete !== null}
        onOpenChange={(open) => !open && setBlockToDelete(null)}
        onConfirm={() => void handleDeleteBlock()}
        isDeleting={isDeletingBlock}
      />

      <NewProjectDialog
        open={blockDialogProjectId !== null}
        onOpenChange={(open) => !open && setBlockDialogProjectId(null)}
        onSubmit={handleCreateBlock}
        title="Nou capítol"
        submitLabel="Afegir"
        placeholder="Títol del capítol"
      />
    </>
  );
}
